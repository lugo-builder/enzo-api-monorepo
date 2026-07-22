import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { EmailService } from '@app/common';
import { EmailSendDto } from './dto/email-send.dto';

@Controller('email')
@ApiTags('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  async sendEmail(
    @Body() EmailSendDto: EmailSendDto,
  ): Promise<{ message: string }> {
    try {
      await this.emailService.testSendEmail(EmailSendDto);
      return {
        message: 'sendEmail ::: controller ::: Email enviado exitosamente',
      };
    } catch (error) {
      return {
        message: 'sendEmail ::: controller ::: Error al enviar el email',
      };
    }
  }
}
