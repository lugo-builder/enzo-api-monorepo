import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingPeriodStatus,
  ChargeTypeStatus,
  ResidentialUnitStatus,
  UnitChargeSource,
  UnitChargeStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { DatabaseService } from '@app/database';

import { AuditService } from '../audit/audit.service';
import {
  BulkProcessErrorDto,
  bulkResponse,
} from '../hydra-shared/bulk-process-response.dto';
import { moneyString, toDecimal } from '../hydra-shared/money.util';
import { GenerateBillingPeriodDto } from './dto/generate-billing-period.dto';

@Injectable()
export class BillingGenerationService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Monto recurrente vigente: RecurringChargeConfig versionado al dueDate/periodo.
   * Fallback a ChargeType.defaultAmount solo si no hay config activa.
   */
  private async resolveRecurringAmount(
    residentialComplexId: string,
    chargeTypeId: string,
    asOf: Date,
  ): Promise<Decimal | null> {
    const config = await this.prisma.recurringChargeConfig.findFirst({
      where: {
        residentialComplexId,
        chargeTypeId,
        status: 'ACTIVE',
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (config) {
      return toDecimal(config.amount);
    }
    const chargeType = await this.prisma.chargeType.findUnique({
      where: { id: chargeTypeId },
    });
    if (chargeType?.defaultAmount != null) {
      return toDecimal(chargeType.defaultAmount as any);
    }
    return null;
  }

  /**
   * Genera cargos recurrentes para viviendas activas.
   * `confirm=false` (default) solo preview. Idempotente al confirmar.
   */
  async generate(
    periodId: string,
    dto: GenerateBillingPeriodDto,
    userId: string,
  ) {
    const period = await this.prisma.billingPeriod.findUnique({
      where: { id: periodId },
    });
    if (!period) throw new NotFoundException('Billing period not found');

    const asOf = period.dueDate ?? new Date(Date.UTC(period.year, period.month - 1, 10));

    const [units, chargeTypes] = await Promise.all([
      this.prisma.residentialUnit.findMany({
        where: {
          residentialComplexId: period.residentialComplexId,
          status: ResidentialUnitStatus.ACTIVE,
          deletedAt: null,
        },
      }),
      this.prisma.chargeType.findMany({
        where: {
          residentialComplexId: period.residentialComplexId,
          status: ChargeTypeStatus.ACTIVE,
          isRecurring: true,
          ...(dto.chargeTypeIds?.length
            ? { id: { in: dto.chargeTypeIds } }
            : {}),
        },
      }),
    ]);

    const errors: BulkProcessErrorDto[] = [];
    const proposed: any[] = [];
    let processed = 0;
    const confirm = !!dto.confirm;

    for (const unit of units) {
      for (const chargeType of chargeTypes) {
        try {
          const existing = await this.prisma.unitCharge.findFirst({
            where: {
              unitId: unit.id,
              billingPeriodId: periodId,
              chargeTypeId: chargeType.id,
              status: { not: UnitChargeStatus.CANCELLED },
            },
          });
          if (existing) {
            continue;
          }

          const amount = await this.resolveRecurringAmount(
            period.residentialComplexId,
            chargeType.id,
            asOf,
          );
          if (!amount) {
            errors.push({
              unitNumber: unit.unitNumber,
              code: 'MISSING_RECURRING_AMOUNT',
              message: `No RecurringChargeConfig or defaultAmount for ${chargeType.code}`,
            });
            continue;
          }

          const proposedCharge = {
            unitId: unit.id,
            unitNumber: unit.unitNumber,
            chargeTypeId: chargeType.id,
            chargeTypeCode: chargeType.code,
            chargeTypeName: chargeType.name,
            amount: moneyString(amount),
            dueDate: period.dueDate,
            source: 'RECURRING_CONFIG',
          };

          if (confirm) {
            await this.prisma.unitCharge.create({
              data: {
                unitId: unit.id,
                billingPeriodId: periodId,
                chargeTypeId: chargeType.id,
                description: chargeType.name,
                amount,
                dueDate: period.dueDate,
                status: UnitChargeStatus.PENDING,
                source: UnitChargeSource.RECURRING_FEE,
                createdBy: userId,
              },
            });
          }

          proposed.push(proposedCharge);
          processed += 1;
        } catch (error: any) {
          errors.push({
            unitNumber: unit.unitNumber,
            code: 'GENERATE_CHARGE_ERROR',
            message: error?.message ?? 'Unknown error generating charge',
          });
        }
      }
    }

    if (confirm) {
      await this.prisma.billingPeriod.update({
        where: { id: periodId },
        data: {
          status: BillingPeriodStatus.GENERATED,
          generatedAt: new Date(),
          updatedBy: userId,
        },
      });
      await this.auditService.log({
        userId,
        entityType: 'BillingPeriod',
        entityId: periodId,
        action: 'BILLING_PERIOD_GENERATE',
        newData: { processed, failed: errors.length },
      });
    }

    return {
      ...bulkResponse(units.length * Math.max(chargeTypes.length, 1), processed, errors),
      preview: !confirm,
      proposed,
    };
  }
}
