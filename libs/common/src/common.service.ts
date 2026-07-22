import { Injectable } from '@nestjs/common';

import { Microservice } from '@app/common/enums/microservice';
import { QUEUES } from './consts';

@Injectable()
export class CommonService {
  private readonly queues: Record<string, Record<string, string>>;

  constructor() {
    console.log('CommonService - QUEUES', JSON.stringify(QUEUES));

    const ERP_SYNC_ITEM_PROCESS_JOB_QUEUE_URL =
      process.env.ERP_SYNC_ITEM_PROCESS_JOB_QUEUE_URL;
    const ERP_SYNC_ORDER_PROCESS_JOB_QUEUE_URL =
      process.env.ERP_SYNC_ORDER_PROCESS_JOB_QUEUE_URL;
    const ERP_YUJU_GUIDE_FETCH_JOB_QUEUE_URL =
      process.env.ERP_YUJU_GUIDE_FETCH_JOB_QUEUE_URL;
    const MKT_SYNC_ORDER_PROCESS_JOB_QUEUE_URL =
      process.env.MKT_SYNC_ORDER_PROCESS_JOB_QUEUE_URL;
    const MKT_SYNC_ITEM_PROCESS_JOB_QUEUE_URL =
      process.env.MKT_SYNC_ITEM_PROCESS_JOB_QUEUE_URL;

    console.log(
      'CommonService - ENV',
      JSON.stringify({
        ERP_SYNC_ITEM_PROCESS_JOB_QUEUE_URL,
        ERP_SYNC_ORDER_PROCESS_JOB_QUEUE_URL,
        ERP_YUJU_GUIDE_FETCH_JOB_QUEUE_URL,
        MKT_SYNC_ORDER_PROCESS_JOB_QUEUE_URL,
        MKT_SYNC_ITEM_PROCESS_JOB_QUEUE_URL,
      }),
    );

    this.queues = {
      [Microservice.ERP]: {
        [QUEUES.ERP.erp_sync_item_process_job]:
          ERP_SYNC_ITEM_PROCESS_JOB_QUEUE_URL,
        [QUEUES.ERP.erp_sync_order_process_job]:
          ERP_SYNC_ORDER_PROCESS_JOB_QUEUE_URL,
        [QUEUES.ERP.erp_yuju_guide_fetch_job]:
          ERP_YUJU_GUIDE_FETCH_JOB_QUEUE_URL,
      },
      [Microservice.MKT]: {
        [QUEUES.MKT.mkt_sync_order_process_job]:
          MKT_SYNC_ORDER_PROCESS_JOB_QUEUE_URL,
        [QUEUES.MKT.mkt_sync_item_process_job]:
          MKT_SYNC_ITEM_PROCESS_JOB_QUEUE_URL,
        // TODO: Configurar esta variable de entorno cuando la cola esté creada en AWS
        // [QUEUES.MKT.mkt_sync_item_process_job_v2]:
        //   process.env.MKT_SYNC_ITEM_PROCESS_JOB_V2_QUEUE_URL,
      },
    };

    console.log('CommonService - this.queues', JSON.stringify(this.queues));
  }

  getQueuesURLS(microserviceType: string = ''): Record<string, string> {
    return (
      this.queues[microserviceType] ||
      Object.keys(this.queues).reduce((acc, curr) => {
        acc = { ...acc, ...this.queues[curr] };
        return acc;
      }, {})
    );
  }
}
