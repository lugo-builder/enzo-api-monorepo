import { LogService } from '@app/log';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum YujuOperationType {
  INVENTORY_UPDATE = 'INVENTORY_UPDATE',
  REPORT_REQUEST = 'REPORT_REQUEST',
  OTHER = 'OTHER',
}

export interface YujuRequestMetadata {
  operationType?: YujuOperationType;
  productId?: string;
  skuErp?: string;
  userId?: string;
  channelId?: string;
  orderId?: string;
  [key: string]: any;
}

export interface YujuRequest {
  id: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  headers?: Record<string, string>;
  retryCount?: number;
  maxRetries?: number;
  metadata?: YujuRequestMetadata;
}

@Injectable()
export class YujuQueueService {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly logService: LogService,
  ) {
    this.sqsClient = new SQSClient({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  /**
   * Enqueues a request to be processed by Yuju
   * @param request - The YujuRequest object containing request details
   */
  async enqueue(request: YujuRequest): Promise<void> {
    try {
      const queueUrl = this.configService.get<string>('YUJU_QUEUE_URL');
      const region = this.configService.get<string>('AWS_REGION');

      if (!queueUrl || !region) {
        throw new Error(
          'Missing required environment variables: YUJU_QUEUE_URL or AWS_REGION',
        );
      }

      if (!request?.id || !request?.endpoint) {
        throw new Error('Invalid request: missing required fields');
      }

      const messageBody = JSON.stringify({
        ...request,
        timestamp: new Date().toISOString(),
      });

      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: messageBody,
        MessageAttributes: {
          RequestId: {
            DataType: 'String',
            StringValue: request.id,
          },
          Endpoint: {
            DataType: 'String',
            StringValue: request.endpoint,
          },
          Timestamp: {
            DataType: 'String',
            StringValue: new Date().toISOString(),
          },
        },
      });

      this.logService.debug('Sending message to SQS', YujuQueueService.name, {
        messageId: request.id,
        messageBody,
        queueUrl,
        region,
      });

      const result = await this.sqsClient.send(command);

      this.logService.info('Message sent successfully', YujuQueueService.name, {
        messageId: request.id,
        result,
      });
    } catch (error) {
      this.logService.error(
        `Failed to enqueue request ${request?.id}:`,
        YujuQueueService.name,
        {
          error: error.message,
          code: error.code,
          requestId: request?.id,
          endpoint: request?.endpoint,
        },
      );

      if (error.code === 'CredentialsProviderError') {
        throw new Error('AWS credentials not properly configured');
      } else if (error.code === 'InvalidParameterValue') {
        throw new Error(`Invalid message format: ${error.message}`);
      } else if (error.code === 'AccessDenied') {
        throw new Error('Insufficient permissions to access SQS queue');
      } else if (error.code === 'QueueDoesNotExist') {
        throw new Error(
          `SQS queue does not exist: ${this.configService.get('YUJU_QUEUE_URL')}`,
        );
      }

      throw error;
    }
  }

  /**
   * This method enqueues a request with a delay for retry attempts.
   * It converts the delay from milliseconds to seconds and ensures it is not greater than 15 minutes.
   *
   * @param request - The YujuRequest object containing request details
   * @param delaySeconds - The delay in milliseconds
   * @throws Error if the queue URL is not configured
   */
  async enqueueWithDelay(
    request: YujuRequest,
    delaySeconds: number,
  ): Promise<void> {
    try {
      const queueUrl = this.configService.get<string>('YUJU_QUEUE_URL');

      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          ...request,
          timestamp: new Date().toISOString(),
        }),
        DelaySeconds: Math.min(Math.floor(delaySeconds / 1000), 900), // Convertir a segundos, max 15 min
        MessageAttributes: {
          RequestId: {
            DataType: 'String',
            StringValue: request.id,
          },
          Endpoint: {
            DataType: 'String',
            StringValue: request.endpoint,
          },
          RetryCount: {
            DataType: 'Number',
            StringValue: (request.retryCount || 0).toString(),
          },
          Timestamp: {
            DataType: 'String',
            StringValue: new Date().toISOString(),
          },
        },
      });

      await this.sqsClient.send(command);

      this.logService.debug(
        `Enqueued Yuju request ${request.id} with ${delaySeconds}ms delay`,
        YujuQueueService.name,
        {
          requestId: request.id,
          delaySeconds,
        },
      );
    } catch (error) {
      this.logService.error(
        `Failed to enqueue delayed request ${request.id}:`,
        YujuQueueService.name,
        {
          error: error.message,
          code: error.code,
          requestId: request?.id,
          endpoint: request?.endpoint,
        },
      );
      throw error;
    }
  }

  /**
   * Convenience method to enqueue multiple requests
   *
   * @param requests - The array of YujuRequest objects to enqueue
   */
  async enqueueBatch(requests: YujuRequest[]): Promise<void> {
    const promises = requests.map((request) => this.enqueue(request));
    await Promise.all(promises);
  }
}
