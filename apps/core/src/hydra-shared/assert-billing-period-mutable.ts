import { ConflictException, NotFoundException } from '@nestjs/common';
import { BillingPeriodStatus } from '@prisma/client';

import { DatabaseService } from '@app/database';

type DbClient = Pick<DatabaseService, 'billingPeriod'>;

/**
 * Bloquea mutaciones financieras ligadas a un BillingPeriod CLOSED.
 * Reapertura requiere permiso RESIDENT_PERIOD_REOPEN en el endpoint de reopen.
 */
export async function assertBillingPeriodMutable(
  db: DbClient,
  billingPeriodId: string | null | undefined,
  action = 'modify financial data',
) {
  if (!billingPeriodId) return;
  const period = await db.billingPeriod.findUnique({
    where: { id: billingPeriodId },
  });
  if (!period) throw new NotFoundException('Billing period not found');
  if (period.status === BillingPeriodStatus.CLOSED) {
    throw new ConflictException(
      `Cannot ${action} while billing period is CLOSED; reopen with RESIDENT_PERIOD_REOPEN first`,
    );
  }
}
