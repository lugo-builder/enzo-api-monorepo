import { EmailModule } from '@app/common';
import { CommonModule } from '@app/common/common.module';
import { Module } from '@nestjs/common';

import { AuthService } from '../auth/auth.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [CommonModule, EmailModule.forRoot('core')],
  controllers: [UsersController],
  providers: [UsersService, AuthService],
})
export class UsersModule {}
