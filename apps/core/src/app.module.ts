import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { EmailModule } from '@app/common';
import { DatabaseModule } from '@app/database';
import { LogModule } from '@app/log';
import { AccountStatementsModule } from './account-statements/account-statements.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BankTransactionsModule } from './bank-transactions/bank-transactions.module';
import { BillingPeriodsModule } from './billing-periods/billing-periods.module';
import { ChargesModule } from './charges/charges.module';
import { ResidentialComplexesModule } from './residential-complexes/residential-complexes.module';
import { HydraDashboardModule } from './hydra-dashboard/hydra-dashboard.module';
import { ImportsModule } from './imports/imports.module';
import { PaymentsModule } from './payments/payments.module';
import { RepositoryModule } from './repository/repository.module';
import { ResidentsModule } from './residents/residents.module';
import { RoleController } from './role/role.controller';
import { RoleService } from './role/role.service';
import { UnitsModule } from './units/units.module';
import { UsersModule } from './users/users.module';
import { WaterMetersModule } from './water-meters/water-meters.module';
import { WaterReadingsModule } from './water-readings/water-readings.module';
import { WaterTariffsModule } from './water-tariffs/water-tariffs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    EmailModule.forRoot('core'),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/static',
    }),
    RepositoryModule,
    LogModule,
    // Hydra residentialComplex modules
    AuditModule,
    ResidentialComplexesModule,
    UnitsModule,
    ResidentsModule,
    WaterMetersModule,
    WaterTariffsModule,
    WaterReadingsModule,
    BillingPeriodsModule,
    ChargesModule,
    PaymentsModule,
    BankTransactionsModule,
    AccountStatementsModule,
    ImportsModule,
    HydraDashboardModule,
  ],
  controllers: [AppController, RoleController],
  providers: [AppService, RoleService],
})
export class AppModule {}
