import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { ConfigService } from '@nestjs/config';
import { CustomTransportStrategy, Server } from '@nestjs/microservices';
import { catchError, firstValueFrom, Observable } from 'rxjs';
import { CommonService } from './common.service';

interface QueueMapping {
  [pattern: string]: string;
}

export class SQSTransporter extends Server implements CustomTransportStrategy {
  private readonly sqsClient: SQSClient;
  private readonly queueMapping: QueueMapping;

  constructor(
    private readonly commonService: CommonService,
    private readonly configService: ConfigService,
    private readonly microserviceType?: string,
  ) {
    super();
    this.sqsClient = new SQSClient({
      region: this.configService.get('AWS_REGION'),
    });
    console.log('SQS Transporter initialized', microserviceType);
    this.queueMapping = this.commonService.getQueuesURLS(this.microserviceType);
  }

  async listen(callback: () => void) {
    await Promise.all(
      Object.values(this.queueMapping).map((queueUrl) =>
        this.pollMessages(queueUrl, this.microserviceType),
      ),
    );
    callback();
  }

  close() {
    // Implement any cleanup logic here if needed
  }

  private async pollMessages(queueUrl: string, microserviceType: string) {
    console.log('Polling messages from SQS', queueUrl, microserviceType);
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: this.configService.get('SQS_MAX_MESSAGES', 1),
      WaitTimeSeconds: this.configService.get('SQS_WAIT_TIME', 20),
      VisibilityTimeout: this.configService.get('SQS_VISIBILITY_TIMEOUT', 30),
    });

    try {
      const response = await this.sqsClient.send(command);
      if (response.Messages) {
        for (const message of response.Messages) {
          this.handleMessage(queueUrl, message);
        }
      }
    } catch (error) {
      console.error('Error receiving messages from SQS:', error);
    } finally {
      setImmediate(() => this.pollMessages(queueUrl, this.microserviceType));
    }
  }

  private async handleMessage(queueUrl: string, message: any) {
    const { Body, ReceiptHandle } = message;
    console.log('Received message from SQS', queueUrl, Body);
    const urls = this.commonService.getQueuesURLS();
    const pattern = Object.keys(urls).find((key) => {
      return urls[key] === queueUrl;
    });

    if (Body && pattern) {
      let parsedMessage: any;
      try {
        parsedMessage = JSON.parse(Body).data;
      } catch (error) {
        console.warn('Error parsing message body as JSON:', error);
        parsedMessage = Body;
      }
      const handler = this.getHandlerByPattern(pattern);

      if (handler) {
        try {
          const result = await handler(parsedMessage);
          if (result instanceof Observable) {
            await firstValueFrom(
              result.pipe(
                catchError((error) => {
                  console.error('Error handling message:', error);
                  throw error;
                }),
              ),
            );
          } else if (!(result instanceof Error)) {
            await this.deleteMessage(queueUrl, ReceiptHandle);
          } else {
            console.error('Handler returned an error:', result);
          }
        } catch (error) {
          console.error('Error handling message:', error);
        }
      }
    }
  }

  private async deleteMessage(queueUrl: string, receiptHandle: string) {
    console.log('Deleting message from SQS', receiptHandle, queueUrl);
    const command = new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    });

    try {
      await this.sqsClient.send(command);
    } catch (error) {
      console.error('Error deleting message from SQS:', error);
    }
  }
}
