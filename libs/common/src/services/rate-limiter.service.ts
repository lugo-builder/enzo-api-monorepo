import { LogService } from '@app/log';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RateLimiterService {
  private lastRequestTime: number = 0;
  private readonly MIN_INTERVAL = 500;

  constructor(private readonly logService: LogService) {}

  /**
   * Waits for the next available time slot before allowing another request.
   * This method implements rate limiting by ensuring a minimum interval between requests.
   *
   * @returns A promise that resolves when the next time slot is available
   *
   * @description
   * - Calculates time elapsed since last request
   * - If less than minimum interval, waits for remaining time
   * - Updates the last request timestamp
   */
  async waitForNextAvailableSlot(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.MIN_INTERVAL) {
      const waitTime = this.MIN_INTERVAL - timeSinceLastRequest;
      this.logService.debug(
        `Rate limiting: waiting ${waitTime}ms (${timeSinceLastRequest}ms since last request)`,
        RateLimiterService.name,
        {
          waitTime,
          timeSinceLastRequest,
          minInterval: this.MIN_INTERVAL,
        },
      );
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
    this.logService.debug(
      `Rate limiting: request allowed after ${timeSinceLastRequest}ms`,
      RateLimiterService.name,
      {
        timeSinceLastRequest,
        minInterval: this.MIN_INTERVAL,
      },
    );
  }

  /**
   * Sleeps for a given number of milliseconds
   *
   * @param ms - The number of milliseconds to sleep
   * @returns A promise that resolves after the specified time
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
