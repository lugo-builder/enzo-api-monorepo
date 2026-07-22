import { Injectable } from '@nestjs/common';

import { DatabaseService, OrderProcessHistoryRepoService } from '@app/database';
import { LogService } from '@app/log';

/** Local enum when Prisma schema does not include order process types */
const OrderProcessTypes = { CREATE_IN_ERP: 'CREATE_IN_ERP' } as const;

interface ProcessHistoryData {
  id: string;
  userMessage: string;
  technicalMessage: string;
}

@Injectable()
export class ProcessHistoryService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly orderProcessHistoryRepoService: OrderProcessHistoryRepoService,
    private readonly logService: LogService,
  ) {}

  async setOrderProcessHistory(processData: ProcessHistoryData) {
    this.logService.info(
      'Creating single order process history',
      ProcessHistoryService.name,
      processData,
    );

    try {
      await this.orderProcessHistoryRepoService.create({
        data: {
          orderId: processData.id,
          processType: OrderProcessTypes.CREATE_IN_ERP,
          description: processData.userMessage,
          errorMessage: processData.technicalMessage,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error creating order process history',
        ProcessHistoryService.name,
        { processData, error },
      );
      throw error;
    }
  }

  async setMultipleOrderProcessHistory(processDataArray: ProcessHistoryData[]) {
    if (!processDataArray || processDataArray.length === 0) {
      return;
    }

    this.logService.info(
      'Creating multiple order process history records',
      ProcessHistoryService.name,
      { count: processDataArray.length },
    );

    try {
      const dataToInsert = processDataArray.map((processData) => ({
        orderId: processData.id,
        processType: OrderProcessTypes.CREATE_IN_ERP,
        description: processData.userMessage,
        errorMessage: processData.technicalMessage,
      }));

      await this.orderProcessHistoryRepoService.createMany({
        data: dataToInsert,
      });

      this.logService.info(
        'Successfully created multiple order process history records',
        ProcessHistoryService.name,
        { count: processDataArray.length },
      );
    } catch (error) {
      this.logService.error(
        'Error creating multiple order process history records',
        ProcessHistoryService.name,
        { count: processDataArray.length, error },
      );
      throw error;
    }
  }
}
