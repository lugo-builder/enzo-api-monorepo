import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LogService } from '@app/log';
import { OrderStatus } from '@prisma/client';
import axios from 'axios';

export interface YujuResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
}

export interface StdReportDto {
  token: string | null;
  channelIntegratorId: string;
  startDate: string | null; // formato ISO o yyyy-mm-dd
  endDate: string | null; // formato ISO o yyyy-mm-dd
  channelsIds?: number[];
  type?: 'orders' | 'products' | 'unknown';
  readyToSendReport?: boolean;
  countOrderReportRequest?: number;
}

@Injectable()
export class YujuService {
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logService: LogService,
  ) {
    this.baseUrl = this.configService.get<string>('YUJU_API_URL');
  }

  private mapToYujuStatus(status: OrderStatus): 'shipped' | 'delivered' {
    const map = {
      IN_TRANSIT: 'shipped',
      DELIVERED: 'delivered',
    } as const;
    return map[status];
  }

  async sendYujuStatusUpdate(params: {
    yujuToken: string;
    yujuOrderId: string | number;
    yujuChannelId: number;
    status: OrderStatus;
    carrier?: string;
    tracking?: string | number;
  }) {
    const { yujuToken, yujuOrderId, yujuChannelId, status, carrier, tracking } =
    params;

    try{
       
      const payload: Record<string, any> = {
        id_order: yujuOrderId,
        id_channel: yujuChannelId,
        status: this.mapToYujuStatus(status), // "shipped" | "delivered"
      };
  
      if (carrier) payload.carrier = String(carrier);
      if (tracking) payload.tracking_code = String(tracking);
  
      const url = `${this.baseUrl}/orders/status`; // PUT
      this.logService.info('Sending Yuju status update', YujuService.name, {
        payload,
      });
      const response = await axios.put(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${yujuToken}`,
          'X-Request-ID': '',
        },
        timeout: 15000,
      });
  
      if (!response?.data || response.data.ok !== 1) {
        throw new Error(
          `YUJU no confirmó la actualización: ${JSON.stringify(response?.data)}`,
        );
      }
      this.logService.info(
        'Yuju status update sent successfully',
        YujuService.name,
        { response: response.data },
      );
      return response.data; 
      } catch (error) {
        this.logService.error('Error sending Yuju status update', YujuService.name, { error: error.message, params });
      }
  }

  /**
   * Cancels an order in Yuju using PUT /orders/status with status 'cancelled'
   * @param params - Parameters for the cancellation request
   * @returns Object indicating success or failure with optional error message
   */
  async cancelOrderInYuju(params: {
    yujuToken: string;
    yujuOrderId: string | number;
    yujuChannelId: number;
  }): Promise<{ success: boolean; error?: string }> {
    const { yujuToken, yujuOrderId, yujuChannelId } = params;

    try {
      const payload = {
        id_order: yujuOrderId,
        id_channel: yujuChannelId,
        status: 'canceled',
      };

      const url = `${this.baseUrl}/orders/status`;
      this.logService.info('Sending Yuju cancellation request', YujuService.name, {
        payload,
      });

      const response = await axios.put(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: yujuToken,
          'X-Request-ID': '',
        },
        timeout: 15000,
      });

      if (!response?.data || response.data.ok !== 1) {
        const errorMessage = `Yuju did not confirm cancellation: ${JSON.stringify(response?.data)}`;
        this.logService.warn('Yuju cancellation not confirmed', YujuService.name, {
          response: response?.data,
          params,
        });
        return { success: false, error: errorMessage };
      }

      this.logService.info('Yuju cancellation sent successfully', YujuService.name, {
        response: response.data,
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      this.logService.error('Error cancelling order in Yuju', YujuService.name, {
        error: errorMessage,
        params,
      });
      return { success: false, error: errorMessage };
    }
  }
}
