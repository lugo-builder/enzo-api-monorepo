import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '@app/database';
import { LogModule } from '@app/log';

import { CommonService } from './common.service';
import {
  PublisherService,
  RateLimiterService,
  S3Service,
  ZplService,
} from './services';

@Module({
  imports: [ConfigModule, HttpModule, DatabaseModule, LogModule],
  providers: [
    CommonService,
    PublisherService,
    RateLimiterService,
    S3Service,
    ZplService,
  ],
  exports: [
    CommonService,
    PublisherService,
    RateLimiterService,
    S3Service,
    ZplService,
  ],
})
export class CommonModule {}
