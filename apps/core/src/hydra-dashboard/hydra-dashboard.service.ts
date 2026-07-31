import { Injectable, NotFoundException } from '@nestjs/common';
import { ResidentialUnitStatus, UnitChargeStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { DatabaseService } from '@app/database';

import { moneyString, toDecimal } from '../hydra-shared/money.util';
import { UnitBalanceService } from '../payments/unit-balance.service';

@Injectable()
export class HydraDashboardService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly balanceService: UnitBalanceService,
  ) {}

  private async assertResidentialComplex(residentialComplexId: string) {
    const residentialComplex = await this.prisma.residentialComplex.findFirst({
      where: { id: residentialComplexId, deletedAt: null },
    });
    if (!residentialComplex) throw new NotFoundException('ResidentialComplex not found');
    return residentialComplex;
  }

  async summary(residentialComplexId: string) {
    const residentialComplex = await this.assertResidentialComplex(residentialComplexId);

    const [totalUnits, activeUnits, residentsCount, openCharges] = await Promise.all([
      this.prisma.residentialUnit.count({ where: { residentialComplexId, deletedAt: null } }),
      this.prisma.residentialUnit.count({
        where: { residentialComplexId, status: ResidentialUnitStatus.ACTIVE, deletedAt: null },
      }),
      this.prisma.unitResident.count({
        where: { status: 'ACTIVE', unit: { residentialComplexId, deletedAt: null } },
      }),
      this.prisma.unitCharge.count({
        where: {
          unit: { residentialComplexId },
          status: { in: [UnitChargeStatus.PENDING, UnitChargeStatus.PARTIALLY_PAID] },
        },
      }),
    ]);

    const units = await this.prisma.residentialUnit.findMany({
      where: { residentialComplexId, status: ResidentialUnitStatus.ACTIVE, deletedAt: null },
    });

    let totalOutstanding = new Decimal(0);
    for (const unit of units) {
      const balance = await this.balanceService.balanceUntil(unit.id);
      if (balance.gt(0)) totalOutstanding = totalOutstanding.plus(balance);
    }

    return {
      residentialComplex: { id: residentialComplex.id, name: residentialComplex.name, currency: residentialComplex.currency },
      totalUnits,
      activeUnits,
      residentsCount,
      openChargesCount: openCharges,
      totalOutstandingBalance: moneyString(totalOutstanding),
    };
  }

  async collection(residentialComplexId: string, year?: number, month?: number) {
    await this.assertResidentialComplex(residentialComplexId);

    const where: any = { residentialComplexId };
    if (year) where.year = year;
    if (month) where.month = month;

    const periods = await this.prisma.billingPeriod.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: year || month ? undefined : 12,
    });

    const results = [];
    for (const period of periods) {
      const charges = await this.prisma.unitCharge.findMany({
        where: { billingPeriodId: period.id, status: { not: UnitChargeStatus.CANCELLED } },
        include: { paymentApplications: { where: { reversedAt: null } } },
      });

      let totalCharged = new Decimal(0);
      let totalCollected = new Decimal(0);
      for (const charge of charges) {
        totalCharged = totalCharged.plus(toDecimal(charge.amount));
        for (const app of charge.paymentApplications) {
          totalCollected = totalCollected.plus(toDecimal(app.amount));
        }
      }
      const collectionRate = totalCharged.gt(0)
        ? totalCollected.div(totalCharged).mul(100).toFixed(2)
        : '0.00';

      results.push({
        billingPeriodId: period.id,
        year: period.year,
        month: period.month,
        name: period.name,
        totalCharged: moneyString(totalCharged),
        totalCollected: moneyString(totalCollected),
        collectionRatePercent: collectionRate,
      });
    }

    return results;
  }

  async delinquency(residentialComplexId: string) {
    await this.assertResidentialComplex(residentialComplexId);

    const units = await this.prisma.residentialUnit.findMany({
      where: { residentialComplexId, status: ResidentialUnitStatus.ACTIVE, deletedAt: null },
    });

    const now = new Date();
    const delinquentUnits: any[] = [];
    let totalPastDue = new Decimal(0);

    for (const unit of units) {
      const pastDue = await this.balanceService.pastDue(unit.id, now);
      if (pastDue.gt(0)) {
        totalPastDue = totalPastDue.plus(pastDue);
        delinquentUnits.push({
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          pastDueBalance: moneyString(pastDue),
        });
      }
    }

    delinquentUnits.sort((a, b) => Number(b.pastDueBalance) - Number(a.pastDueBalance));

    return {
      residentialComplexId,
      delinquentUnitsCount: delinquentUnits.length,
      totalPastDue: moneyString(totalPastDue),
      units: delinquentUnits,
    };
  }

  async waterConsumption(residentialComplexId: string, year?: number, month?: number) {
    await this.assertResidentialComplex(residentialComplexId);

    const where: any = { residentialComplexId };
    if (year) where.billingYear = year;
    if (month) where.billingMonth = month;

    const periods = await this.prisma.waterBillingPeriod.findMany({
      where,
      orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }],
      take: year || month ? undefined : 12,
    });

    const results = [];
    for (const period of periods) {
      const readings = await this.prisma.waterReading.findMany({
        where: { billingPeriodId: period.id, status: { not: 'CANCELLED' } },
      });

      let totalConsumption = new Decimal(0);
      let totalBilled = new Decimal(0);
      for (const reading of readings) {
        totalConsumption = totalConsumption.plus(toDecimal(reading.consumptionM3));
        totalBilled = totalBilled.plus(toDecimal(reading.finalAmount));
      }
      const avgConsumption = readings.length
        ? totalConsumption.div(readings.length).toFixed(4)
        : '0.0000';

      results.push({
        billingPeriodId: period.id,
        billingYear: period.billingYear,
        billingMonth: period.billingMonth,
        name: period.name,
        unitsRead: readings.length,
        totalConsumptionM3: totalConsumption.toFixed(4),
        averageConsumptionM3: avgConsumption,
        totalBilled: moneyString(totalBilled),
      });
    }

    return results;
  }
}
