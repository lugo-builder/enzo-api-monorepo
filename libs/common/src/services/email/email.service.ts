import { LogService } from '@app/log';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import * as path from 'path';
import { EmailSendDto } from '../../dto/email-send.dto';

@Injectable()
export class EmailService {
  private readonly ses: AWS.SES;
  private readonly isProd = process.env.NODE_ENV !== 'local';
  private readonly appTemplatesDir: string;
  private readonly appPartialsDir: string;
  private readonly sharedTemplatesDir: string;
  private readonly sharedPartialsDir: string;

  private partialsLoaded = false;

  private async loadTemplate(templateName: string): Promise<string> {
    await this.loadPartials();

    // Try app-specific template first, then shared template
    const appTemplatePath = path.join(this.appTemplatesDir, `${templateName}.hbs`);
    const sharedTemplatePath = path.join(this.sharedTemplatesDir, `${templateName}.hbs`);

    try {
      await fs.promises.access(appTemplatePath);
      return fs.promises.readFile(appTemplatePath, 'utf-8');
    } catch {
      // App template not found, try shared
      return fs.promises.readFile(sharedTemplatePath, 'utf-8');
    }
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly logService: LogService,
    @Inject('APP_NAME') private readonly appName: string,
  ) {
    // App-specific templates
    this.appTemplatesDir = this.isProd
      ? path.join(__dirname, 'templates')
      : path.join(
          process.cwd(),
          'apps',
          this.appName,
          'src',
          'email',
          'templates',
        );

    this.appPartialsDir = this.isProd
      ? path.join(__dirname, 'templates', 'partials')
      : path.join(
          process.cwd(),
          'apps',
          this.appName,
          'src',
          'email',
          'templates',
          'partials',
        );

    // Shared templates
    this.sharedTemplatesDir = this.isProd
      ? path.join(__dirname, '..', 'shared-templates')
      : path.join(
          process.cwd(),
          'libs',
          'common',
          'src',
          'email',
          'templates',
        );

    this.sharedPartialsDir = this.isProd
      ? path.join(__dirname, '..', 'shared-templates', 'partials')
      : path.join(
          process.cwd(),
          'libs',
          'common',
          'src',
          'email',
          'templates',
          'partials',
        );

    // Configurar el SDK de AWS
    this.logService.log('Configuring AWS SES', EmailService.name, {
      AWS_ACCESS_KEY_ID_SES: process.env.AWS_ACCESS_KEY_ID_SES,
      AWS_SECRET_ACCESS_KEY_SES: process.env.AWS_SECRET_ACCESS_KEY_SES,
      AWS_REGION_SES: this.configService.get<string>('AWS_REGION_SES'),
      APP_NAME: this.appName,
    });
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID_SES,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_SES,
      region: this.configService.get<string>('AWS_REGION_SES'),
    });
    this.ses = new AWS.SES({ apiVersion: '2010-12-01' });
  }

  private async loadPartials() {
    if (this.partialsLoaded) {
      return;
    }

    const loadPartialsFromDir = async (dir: string) => {
      try {
        const filenames = await fs.promises.readdir(dir);
        const promises = filenames.map(async (filename) => {
          const matches = /^([^.]+).hbs$/.exec(filename);
          if (!matches) {
            return;
          }
          const name = matches[1];
          const filepath = path.join(dir, filename);
          const template = await fs.promises.readFile(filepath, 'utf8');
          handlebars.registerPartial(name, template);
        });
        await Promise.all(promises);
      } catch {
        // Directory doesn't exist, skip
      }
    };

    // Load shared partials first, then app-specific (app can override shared)
    await loadPartialsFromDir(this.sharedPartialsDir);
    await loadPartialsFromDir(this.appPartialsDir);

    this.partialsLoaded = true;
  }

  async testSendEmail(emailSendDto: EmailSendDto): Promise<void> {
    const params = {
      Source: this.configService.get<string>('EMAIL_FROM'),
      Destination: {
        ToAddresses: [emailSendDto.to],
      },
      Message: {
        Subject: {
          Data: emailSendDto.subject,
        },
        Body: {
          Html: {
            Data: emailSendDto.body,
          },
        },
      },
    };

    try {
      await this.ses.sendEmail(params).promise();
    } catch (error) {
      this.logService.error(
        'testSendEmail: Error to send email with details',
        EmailService.name,
        error,
      );
      throw error;
    }
  }

  async sendEmail(
    templateName: string,
    data: any,
    to: string | string[],
    subject: string,
  ): Promise<void> {
    try {
      const templateContent = await this.loadTemplate(templateName);
      const template = handlebars.compile(templateContent);
      const html = template(data);
      const params = {
        Source: this.configService.get<string>('EMAIL_FROM'),
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to],
        },
        Message: {
          Subject: {
            Data: subject,
          },
          Body: {
            Html: {
              Data: html,
            },
          },
        },
      };
      const result = await this.ses.sendEmail(params).promise();
      this.logService.log(
        'sendEmail: Email sent successfully',
        EmailService.name,
        {
          templateName,
          to,
          subject,
          data,
          result,
        },
      );
    } catch (error) {
      this.logService.error(
        'sendEmail: Error to send email with detail',
        EmailService.name,
        error,
      );
    }
  }
}
