import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Can, CurrentUser, Roles, RolesEnum } from '@app/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsEnum } from '../role/types/permissions.enums';
import { ApplyPaymentDto } from './dto/apply-payment.dto';
import { CancelPaymentDto } from './dto/cancel-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentFilterDto } from './dto/payment-filter.dto';
import { ReverseApplicationDto } from './dto/reverse-application.dto';
import { PaymentApplicationService } from './payment-application.service';
import { PaymentsService } from './payments.service';

@Controller('payments')
@ApiTags('payments')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentApplicationService: PaymentApplicationService,
  ) {}

  @Post()
  @Can(PermissionsEnum.RESIDENT_PAYMENTS)
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user) {
    return this.paymentsService.create(dto, user.userId);
  }

  @Get()
  @Can(PermissionsEnum.RESIDENT_PAYMENTS)
  findAll(@Query() query: PaymentFilterDto) {
    return this.paymentsService.findAll(query);
  }

  @Get(':id')
  @Can(PermissionsEnum.RESIDENT_PAYMENTS)
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post(':id/confirm')
  @Can(PermissionsEnum.RESIDENT_PAYMENTS)
  confirm(@Param('id') id: string, @CurrentUser() user) {
    return this.paymentsService.confirm(id, user.userId);
  }

  @Post(':id/apply')
  @Can(PermissionsEnum.RESIDENT_PAYMENTS)
  apply(
    @Param('id') id: string,
    @Body() dto: ApplyPaymentDto,
    @CurrentUser() user,
  ) {
    return this.paymentApplicationService.apply({
      paymentId: id,
      applications: dto.applications,
      userId: user.userId,
    });
  }

  @Post(':id/auto-apply')
  @Can(PermissionsEnum.RESIDENT_PAYMENTS)
  autoApply(@Param('id') id: string, @CurrentUser() user) {
    return this.paymentApplicationService.autoApply(id, user.userId);
  }

  @Post(':id/reverse-application')
  @Can(PermissionsEnum.RESIDENT_PAYMENTS)
  reverseApplication(
    @Param('id') id: string,
    @Body() dto: ReverseApplicationDto,
    @CurrentUser() user,
  ) {
    return this.paymentApplicationService.reverseApplication({
      paymentId: id,
      unitChargeId: dto.unitChargeId,
      reason: dto.reason,
      userId: user.userId,
    });
  }

  @Post(':id/cancel')
  @Can(PermissionsEnum.RESIDENT_PAYMENTS)
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelPaymentDto,
    @CurrentUser() user,
  ) {
    return this.paymentsService.cancel(id, dto.reason, user.userId);
  }
}
