import { LogService } from '@app/log';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';

@Injectable()
export class S3Service {
  private readonly s3: AWS.S3;

  constructor(
    private readonly configService: ConfigService,
    private readonly logService: LogService,
  ) {
    this.logService.info('S3Service - Initializing', S3Service.name, {
      region: this.configService.get('AWS_REGION'),
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
    });

    AWS.config.update({
      region: this.configService.get('AWS_REGION'),
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
    });
    this.s3 = new AWS.S3();
  }

  async uploadFile(
    bucket: string,
    key: string,
    fileBuffer: Buffer,
    contentType: string = 'application/pdf',
  ): Promise<string> {
    try {
      const params = {
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      };

      this.logService.info('S3Service - uploadFile - params', S3Service.name, {
        bucket,
        key,
        contentType,
      });

      const result = await this.s3.upload(params).promise();

      this.logService.info('S3Service - uploadFile - Success', S3Service.name, {
        bucket,
        key,
        location: result.Location,
      });

      return result.Location;
    } catch (error) {
      this.logService.error('S3Service - uploadFile - Error', S3Service.name, {
        bucket,
        key,
        error: error.message,
      });
      throw error;
    }
  }

  async downloadFile(bucket: string, key: string): Promise<Buffer> {
    const result = await this.s3
      .getObject({ Bucket: bucket, Key: key })
      .promise();

    if (!result.Body || !(result.Body instanceof Buffer)) {
      throw new Error('No se pudo obtener el archivo como Buffer');
    }

    return result.Body;
  }
}
