import { DateTime } from "luxon";

/**
 * Validates if enough time has passed since the last product report request.
 * Used by the hourly cron job to determine if an integrator should receive a product report.
 *
 * @param syncAtRequest - Last sync timestamp in 'yyyy-MM-dd HH:mm:ss' format (Mexico City timezone)
 * @returns Object with updated timestamp and whether 25+ hours have passed
 *
 * Rules:
 * - No previous timestamp: Allow request (first time)
 * - 25+ hours elapsed: Allow request and update timestamp
 * - Less than 25 hours: Deny request (passLimitHours = false)
 * - Parse error: Allow request with new timestamp
 */
export function processDateForProductReport(syncAtRequest: string): {
  syncAtRequest: string;
  passLimitHours: boolean;
} {
  const HOURS_THRESHOLD = 25;
  const currentDateTime = DateTime.now().setZone('America/Mexico_City');
  const currentDateTimeFormatted = currentDateTime.toFormat('yyyy-MM-dd HH:mm:ss');
  const statusDateReport = { syncAtRequest, passLimitHours: false };

  try {
    if (!syncAtRequest) {
      statusDateReport.syncAtRequest = currentDateTimeFormatted;
      statusDateReport.passLimitHours = true;
      return statusDateReport;
    }

    const lastSyncDateTime = DateTime.fromFormat(
      syncAtRequest,
      'yyyy-MM-dd HH:mm:ss',
      { zone: 'America/Mexico_City' },
    );
    const hoursDifference = currentDateTime.diff(lastSyncDateTime, 'hours').hours;

    if (hoursDifference >= HOURS_THRESHOLD) {
      statusDateReport.syncAtRequest = currentDateTimeFormatted;
      statusDateReport.passLimitHours = true;
    }
  } catch (error) {
    console.error('DatesUtility: Error processing date for product report', error);
    statusDateReport.syncAtRequest = currentDateTimeFormatted;
    statusDateReport.passLimitHours = true;
  }

  return statusDateReport;
}

export function processDateForReport(syncAtRequest: string): {syncAtRequest: string, passLimitHours: boolean} {

    // For products, manage the sync timestamp
    const currentDateTime = DateTime.now().setZone('America/Mexico_City');
    const currentDateTimeFormatted = currentDateTime.toFormat('yyyy-MM-dd HH:mm:ss');
    let statusDateReport = {syncAtRequest, passLimitHours: false};
    try{
       if(!syncAtRequest){
        statusDateReport.syncAtRequest = currentDateTimeFormatted;
        statusDateReport.passLimitHours = true;
        return statusDateReport;
       }else{
        const lastSyncDateTime = DateTime.fromFormat(syncAtRequest, 'yyyy-MM-dd HH:mm:ss', { zone: 'America/Mexico_City' });
        const hoursDifference = currentDateTime.diff(lastSyncDateTime, 'hours').hours;
        
        if (hoursDifference >= 24) {
          // Update timestamp if 24+ hours passed
          statusDateReport.syncAtRequest = currentDateTimeFormatted;
          statusDateReport.passLimitHours = true;
        }
       }
    }catch(error){
      console.error(
        'DatesUtility: Error processing date for report',error
      );
      statusDateReport.syncAtRequest = currentDateTimeFormatted;
    }
    return statusDateReport;
  }