import { Injectable, Logger, Scope } from '@nestjs/common';

import * as AWS from 'aws-sdk';
import { DateTime } from 'luxon';
import stringify from 'safe-stable-stringify';

@Injectable({ scope: Scope.DEFAULT })
export class LogService {
  private readonly logger = new Logger(LogService.name);
  private readonly cloudWatchLogs: AWS.CloudWatchLogs;
  private readonly logGroupName: string;
  private readonly logStreamPrefix: string;
  private readonly useCloudWatch: boolean;
  private sequenceToken: string | undefined;
  private currentLogStreamName: string;
  private currentDate: string;

  constructor() {
    this.useCloudWatch = ['production', 'sandbox'].includes(
      process.env.NODE_ENV,
    );
    this.logGroupName = process.env.LOG_GROUP_NAME || 'DefaultLogGroup';
    this.logStreamPrefix = process.env.LOG_STREAM_PREFIX || 'App';
    this.currentDate = this.getCurrentDate();
    this.currentLogStreamName = this.buildLogStreamName();

    console.log('LogServiceConfiguration', {
      useCloudWatch: this.useCloudWatch,
      nodeEnv: process.env.NODE_ENV,
      logGroup: this.logGroupName,
      logStream: this.currentLogStreamName,
    });

    if (this.useCloudWatch) {
      AWS.config.update({
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      });
      this.cloudWatchLogs = new AWS.CloudWatchLogs();
      this.ensureLogStream();
    }
  }

  private getCurrentDate(): string {
    return DateTime.local()
      .setZone('America/Mexico_City')
      .toFormat('yyyy-MM-dd');
  }

  private buildLogStreamName(): string {
    return `${this.logStreamPrefix}-${this.currentDate}`;
  }

  private getLogStreamName(): string {
    const newDate = this.getCurrentDate();
    if (newDate !== this.currentDate) {
      this.currentDate = newDate;
      this.currentLogStreamName = this.buildLogStreamName();
      this.sequenceToken = undefined;
      if (this.useCloudWatch) {
        this.ensureLogStream();
      }
    }
    return this.currentLogStreamName;
  }

  private async ensureLogStream() {
    try {
      await this.cloudWatchLogs
        .createLogStream({
          logGroupName: this.logGroupName,
          logStreamName: this.currentLogStreamName,
        })
        .promise();
      this.logger.log(
        `Log stream '${this.currentLogStreamName}' creado exitosamente.`,
      );
    } catch (err) {
      if (err.code === 'ResourceAlreadyExistsException') {
        this.logger.warn(
          `El log stream '${this.currentLogStreamName}' ya existe. Continuando...`,
        );
      } else {
        this.logger.error(
          `Error al crear el log stream '${this.currentLogStreamName}':`,
          err.message,
        );
        throw err;
      }
    }
  }

  private async logToCloudWatch(
    level: string,
    message: string,
    context?: string,
    details?: any,
  ) {
    const logStreamName = this.getLogStreamName();
    const logEvent = {
      level,
      timestamp: DateTime.local()
        .setZone('America/Mexico_City')
        .toFormat('yyyy-MM-dd HH:mm:ss'),
      context,
      message,
      details: stringify(details),
    };

    try {
      const response = await this.cloudWatchLogs
        .putLogEvents({
          logGroupName: this.logGroupName,
          logStreamName: logStreamName,
          logEvents: [
            {
              message: JSON.stringify(logEvent, null, 2),
              timestamp: DateTime.now().toMillis(),
            },
          ],
          sequenceToken: this.sequenceToken,
        })
        .promise();

      this.sequenceToken = response.nextSequenceToken;
    } catch (err) {
      console.error(err);
      this.logger.error('Error al enviar logs a CloudWatch', err.message);
      if (err.code === 'InvalidSequenceTokenException') {
        this.logger.warn('Actualizando sequence token...');
        const describeResponse = await this.cloudWatchLogs
          .describeLogStreams({
            logGroupName: this.logGroupName,
            logStreamNamePrefix: logStreamName,
          })
          .promise();
        const logStream = describeResponse.logStreams?.find(
          (stream) => stream.logStreamName === logStreamName,
        );
        this.sequenceToken = logStream?.uploadSequenceToken;

        // Retry after updating the sequence token
        await this.logToCloudWatch(level, message, context, details);
      }
    }
  }

  async log(message: string, context?: string, details?: any) {
    if (this.useCloudWatch) {
      await this.logToCloudWatch('LOG', message, context, details);
    } else {
      this.logger.log(this.formatLog('LOG', message, context, details));
    }
  }

  async info(message: string, context?: string, details?: any) {
    if (this.useCloudWatch) {
      await this.logToCloudWatch('INFO', message, context, details);
    } else {
      this.logger.verbose(this.formatLog('INFO', message, context, details));
    }
  }

  async warn(message: string, context?: string, details?: any) {
    if (this.useCloudWatch) {
      await this.logToCloudWatch('WARNING', message, context, details);
    } else {
      this.logger.warn(this.formatLog('WARNING', message, context, details));
    }
  }

  async error(message: string, context?: string, details?: any) {
    if (this.useCloudWatch) {
      await this.logToCloudWatch('ERROR', message, context, details);
    } else {
      this.logger.error(
        this.formatLog('ERROR', message, context, details),
        details?.stack,
      );
    }
  }

  async debug(message: string, context?: string, details?: any) {
    if (this.useCloudWatch) {
      await this.logToCloudWatch('DEBUG', message, context, details);
    } else {
      this.logger.debug(this.formatLog('DEBUG', message, context, details));
    }
  }

  private formatLog(
    level: string,
    message: string,
    context?: string,
    details?: any,
  ): string {
    return JSON.stringify(
      {
        level,
        context: context || 'Application',
        message,
        details: stringify(details),
      },
      null,
      2,
    );
  }
}
