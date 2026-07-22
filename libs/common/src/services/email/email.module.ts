import { DynamicModule, Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

@Global()
@Module({})
export class EmailModule {
  static forRoot(appName: string): DynamicModule {
    return {
      module: EmailModule,
      global: true,
      providers: [
        {
          provide: 'APP_NAME',
          useValue: appName,
        },
        EmailService,
      ],
      exports: ['APP_NAME', EmailService],
    };
  }
}
