import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LogInRequestDto } from './dto/login-request.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() req: LogInRequestDto) {
    return this.authService.login(req);
  }

  @Post('verifyToken')
  verifyToken(@Body('token') token: string) {
    return this.authService.verifyToken(token);
  }

  @Post('validateEmail')
  validateEmail(@Body('email') email: string) {
    return this.authService.validateEmail(email);
  }

  @Patch(':token/updatePassword')
  updatePassword(
    @Param('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.updatePassword(token, newPassword);
  }

  @Post('sendRecoveryEmailAdmin')
  sendRecoveryEmailAdmin(@Body('email') email: string) {
    return this.authService.sendRecoveryEmail(email, true);
  }

  @Post('sendRecoveryEmail')
  sendRecoveryEmail(@Body('email') email: string) {
    return this.authService.sendRecoveryEmail(email, false);
  }

  @Post('registerAccount')
  registerAccount(
    @Body('email') email: string,
    @Body('name') name: string,
    @Body('phone') phone: string,
    @Body('company') company?: string,
  ) {
    return this.authService.registerAccount(email, name, phone, company || '');
  }

  @Post('validatePassword')
  validatePassword(@Body() password: string) {
    const errors = this.authService.validatePassword(password);
    return { isValid: errors.length === 0, errors };
  }
}
