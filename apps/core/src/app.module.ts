import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { EmailModule } from '@app/common';
import { DatabaseModule } from '@app/database';
import { LogModule } from '@app/log';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { RepositoryModule } from './repository/repository.module';
import { RoleController } from './role/role.controller';
import { RoleService } from './role/role.service';
import { UsersModule } from './users/users.module';

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
  ],
  controllers: [AppController, RoleController],
  providers: [AppService, RoleService],
})
export class AppModule {}
