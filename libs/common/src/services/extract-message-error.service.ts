import { Injectable } from '@nestjs/common';

@Injectable()
export class ExtractMessageErrorService {
  async errorDetailWithDepthLimit(error: any, depth: number): Promise<any> {
    const getErrorDetails = (err: any, currentDepth: number): any => {
      if (currentDepth > depth) {
        return {};
      }

      return {
        message: err.message,
        summary: err.stack ? err.stack.split('\n')[0] : 'No stack available',
        ...Object.keys(err).reduce((acc, key) => {
          acc[key] =
            typeof err[key] === 'object' && err[key] !== null
              ? getErrorDetails(err[key], currentDepth + 1)
              : err[key];
          return acc;
        }, {}),
      };
    };

    return getErrorDetails(error, 0);
  }
}
