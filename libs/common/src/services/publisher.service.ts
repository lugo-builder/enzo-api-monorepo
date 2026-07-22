import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LogService } from '@app/log';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

import { CommonService } from '../common.service';

@Injectable()
export class PublisherService {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly logService: LogService,
    private readonly configService: ConfigService,
    private readonly commonService: CommonService,
  ) {
    this.sqsClient = new SQSClient({
      region: this.configService.get('AWS_REGION'),
    });
  }

  async publishMessage(pattern: string, data: any, delaySeconds: number = 0) {
    const queueUrl = this.commonService.getQueuesURLS()[pattern];

    if (!queueUrl) {
      throw new Error(`No queue URL mapped for pattern: ${pattern}`);
    }

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ pattern, data }),
      DelaySeconds: delaySeconds,
    });

    try {
      await this.sqsClient.send(command);
    } catch (error) {
      this.logService.error(
        'Error sending message to SQS',
        PublisherService.name,
        error,
      );
    }
  }
}
