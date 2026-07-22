import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

import {
  ProcessLogHistoryRepoService,
  ProcessLogRepoService,
} from '@app/database';
import { LogService } from '@app/log';

/** Local enums when Prisma schema does not include process log types */
const ProcessLogType = {
  SYNC_INVENTORY: 'SYNC_INVENTORY',
  SEND_TO_NEXT: 'SEND_TO_NEXT',
  DOWNLOAD_GUIDE: 'DOWNLOAD_GUIDE',
  CANCEL_ORDER: 'CANCEL_ORDER',
  ORDER_RETURN: 'ORDER_RETURN',
} as const;
const ProcessStatus = { SUCCESS: 'SUCCESS', ERROR: 'ERROR' } as const;
type ProcessStatusType = (typeof ProcessStatus)[keyof typeof ProcessStatus];
type ProcessLogTypeType = (typeof ProcessLogType)[keyof typeof ProcessLogType];

@Injectable()
export class ProcessLogService {
  constructor(
    private readonly processLogRepoService: ProcessLogRepoService,
    private readonly processLogHistoryRepoService: ProcessLogHistoryRepoService,
    private readonly logService: LogService,
  ) {}

  /**
   * Registra un intento de sincronización de inventario
   */
  async logSyncInventory(
    relatedId: string,
    status: ProcessStatusType,
    errorMessage?: any,
    metadata?: any,
  ): Promise<void> {
    try {
      this.logService.info(
        'Logging sync inventory process',
        ProcessLogService.name,
        {
          relatedId,
          status,
        },
      );

      await this.processLogRepoService.create({
        data: {
          processType: ProcessLogType.SYNC_INVENTORY,
          relatedId,
          status,
          origin: 'system',
          errorMessage:
            status === ProcessStatus.ERROR ? (errorMessage as any) : null,
          metadata: metadata as any,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error logging sync inventory process',
        ProcessLogService.name,
        {
          relatedId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Registra un intento de envío a Next ERP
   */
  async logSendToNext(
    orderId: string,
    status: ProcessStatusType,
    errorMessage?: any,
    metadata?: any,
  ): Promise<void> {
    try {
      this.logService.info(
        'Logging send to Next process',
        ProcessLogService.name,
        {
          orderId,
          status,
        },
      );

      await this.processLogRepoService.create({
        data: {
          processType: ProcessLogType.SEND_TO_NEXT,
          relatedId: orderId,
          status,
          origin: 'system',
          errorMessage:
            status === ProcessStatus.ERROR ? (errorMessage as any) : null,
          metadata: metadata as any,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error logging send to Next process',
        ProcessLogService.name,
        {
          orderId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Registra un intento de descarga de guía
   */
  async logDownloadGuide(
    orderId: string,
    status: ProcessStatusType,
    errorMessage?: any,
    metadata?: any,
  ): Promise<void> {
    try {
      this.logService.info(
        'Logging download guide process',
        ProcessLogService.name,
        {
          orderId,
          status,
        },
      );

      await this.processLogRepoService.create({
        data: {
          processType: ProcessLogType.DOWNLOAD_GUIDE,
          relatedId: orderId,
          status,
          origin: 'system',
          errorMessage:
            status === ProcessStatus.ERROR ? (errorMessage as any) : null,
          metadata: metadata as any,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error logging download guide process',
        ProcessLogService.name,
        {
          orderId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Registra el procesamiento de un reporte (órdenes o productos)
   */
  async logReportProcessing(
    processType: ProcessLogTypeType,
    relatedId: string,
    status: ProcessStatusType,
    metadata?: any,
    errorMessage?: any,
  ): Promise<void> {
    try {
      this.logService.info(
        'Logging report processing',
        ProcessLogService.name,
        {
          processType,
          relatedId,
          status,
        },
      );

      await this.processLogRepoService.create({
        data: {
          processType,
          relatedId,
          status,
          origin: 'system',
          metadata: metadata as any,
          errorMessage:
            status === ProcessStatus.ERROR ? (errorMessage as any) : null,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error logging report processing',
        ProcessLogService.name,
        {
          processType,
          relatedId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Registra un intento de cancelación de orden (éxito o fallo)
   */
  async logCancelOrder(
    orderId: string,
    status: ProcessStatusType,
    errorMessage?: any,
    metadata?: any,
  ): Promise<void> {
    try {
      this.logService.info(
        'Logging cancel order process',
        ProcessLogService.name,
        { orderId, status },
      );

      await this.processLogRepoService.create({
        data: {
          processType: ProcessLogType.CANCEL_ORDER,
          relatedId: orderId,
          status,
          origin: 'system',
          errorMessage:
            status === ProcessStatus.ERROR ? (errorMessage as any) : null,
          metadata: metadata as any,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error logging cancel order process',
        ProcessLogService.name,
        { orderId, error: error?.message || error },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Registra el registro de un evento de devolución (RETURNS) sobre una orden.
   * Misma estructura que logCancelOrder: orderId, status (SUCCESS/ERROR), metadata opcional.
   */
  async logOrderReturn(
    orderId: string,
    status: ProcessStatusType,
    errorMessage?: any,
    metadata?: any,
  ): Promise<void> {
    try {
      this.logService.info(
        'Logging order return process',
        ProcessLogService.name,
        { orderId, status },
      );

      await this.processLogRepoService.create({
        data: {
          processType: ProcessLogType.ORDER_RETURN,
          relatedId: orderId,
          status,
          origin: 'system',
          errorMessage:
            status === ProcessStatus.ERROR ? (errorMessage as any) : null,
          metadata: metadata as any,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error logging order return process',
        ProcessLogService.name,
        { orderId, error: error?.message || error },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Archiva registros antiguos de process_log moviéndolos a process_log_history
   * @param monthsToKeep - Número de meses a mantener (default: 2)
   */
  async archiveOldProcessLogs(monthsToKeep: number = 2): Promise<void> {
    try {
      const cutoffDate = DateTime.now()
        .minus({ months: monthsToKeep })
        .toJSDate();

      this.logService.info(
        'Starting archive process logs',
        ProcessLogService.name,
        {
          cutoffDate: cutoffDate.toISOString(),
          monthsToKeep,
        },
      );

      // Obtener registros antiguos
      const oldLogs = await this.processLogRepoService.findMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      if (!oldLogs || oldLogs.length === 0) {
        this.logService.info(
          'No old process logs to archive',
          ProcessLogService.name,
        );
        return;
      }

      this.logService.info(
        `Found ${oldLogs.length} old process logs to archive`,
        ProcessLogService.name,
        {
          count: oldLogs.length,
        },
      );

      // Insertar en histórico
      const historyData = oldLogs.map((log) => ({
        id: log.id,
        processType: log.processType,
        relatedId: log.relatedId,
        status: log.status,
        origin: log.origin,
        errorMessage: log.errorMessage,
        metadata: log.metadata,
        createdAt: log.createdAt,
        archivedAt: new Date(),
      }));

      // Insertar en lotes para evitar problemas con muchos registros
      const batchSize = 1000;
      for (let i = 0; i < historyData.length; i += batchSize) {
        const batch = historyData.slice(i, i + batchSize);
        await this.processLogHistoryRepoService.createMany({
          data: batch,
        });
      }

      // Eliminar de tabla principal
      await this.processLogRepoService.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logService.info(
        'Successfully archived old process logs',
        ProcessLogService.name,
        {
          archivedCount: oldLogs.length,
        },
      );
    } catch (error) {
      this.logService.error(
        'Error archiving old process logs',
        ProcessLogService.name,
        {
          error: error?.message || error,
          stack: error?.stack,
        },
      );
      throw error; // Lanzar error aquí porque es un proceso crítico
    }
  }
}
