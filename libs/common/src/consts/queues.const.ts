export const QUEUES = {
  ERP: {
    erp_sync_item_process_job: 'erp_sync_item_process_job',
    //erp_sync_item_process_job_v2: 'erp_sync_item_process_job_v2',
    erp_sync_order_process_job: 'erp_sync_order_process_job',
    erp_yuju_guide_fetch_job: 'erp_yuju_guide_fetch_job',
  },
  MKT: {
    mkt_sync_order_process_job: 'mkt_sync_order_process_job',
    mkt_sync_item_process_job: 'mkt_sync_item_process_job',
    //mkt_sync_item_process_job_v2: 'mkt_sync_item_process_job_v2',
  },
  YUJU: {
    yuju_failures_queue: 'yuju-failures-queue',
  },
};
