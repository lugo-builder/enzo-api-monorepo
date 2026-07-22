import { HttpException, Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ZplService {
  async convertZplToPdf(zpl: string): Promise<Buffer> {
    try {
      const url = 'http://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/';

      const response = await axios.post(url, zpl, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/pdf',
        },
        responseType: 'arraybuffer',
      });
      //TODO: Rate limit API Labelary
      return Buffer.from(response.data);
    } catch (error) {
      throw new HttpException(
        `Error convirtiendo ZPL a PDF: ${error.message || error}`,
        500,
      );
    }
  }
}
