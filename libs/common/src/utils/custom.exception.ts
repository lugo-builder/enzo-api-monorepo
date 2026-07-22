import { HttpException } from '@nestjs/common';
import stringify from 'safe-stable-stringify';
import { ExceptionInfo } from './error-codes';

export class CustomException extends HttpException {
  constructor(exceptionInfo: ExceptionInfo, errorData?: any) {
    super(
      {
        errorCode: exceptionInfo.code,
        errorMsg: exceptionInfo.errorMsg,
        errorData: stringify(errorData),
      },
      exceptionInfo.httpStatus,
    );
  }
}
