import { HttpStatus } from '@nestjs/common';

export interface ExceptionInfo {
  httpStatus: HttpStatus;
  code: string;
  errorMsg: string;
  data?: any;
}

export const ErrorCodes = {
  TOKEN_REFRESH_ATTEMPTS_EXCEEDED: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'TOKEN_REFRESH_ATTEMPTS_EXCEEDED',
    errorMsg: 'Token refresh attempts exceeded.',
  },
  NOT_FOUND: {
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'NOT_FOUND',
    errorMsg: 'Resource not found.',
  },
  EMAIL_NOT_SENT: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'EMAIL_NOT_SENT',
    errorMsg: 'Email not send.',
  },
  EMAIL_COMPANY_EMAIL: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'EMAIL_COMPANY_EMAIL',
    errorMsg: 'Invalid company email address.',
  },
  INVALID_CREDENTIALS: {
    httpStatus: HttpStatus.UNAUTHORIZED,
    code: 'INVALID_CREDENTIALS',
    errorMsg: 'Invalid credentials.',
  },
  USER_NOT_FOUND: {
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'USER_NOT_FOUND',
    errorMsg: 'User not found.',
  },
  PERMISSION_NOT_FOUND: {
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'PERMISSION_NOT_FOUND',
    errorMsg: 'Permission not found.',
  },
  INVALID_TOKEN: {
    httpStatus: HttpStatus.UNAUTHORIZED,
    code: 'INVALID_TOKEN',
    errorMsg: 'Invalid token.',
  },
  INVALID_KEY: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'INVALID_KEY',
    errorMsg: 'Invalid key.',
  },
  UNHANDLED_EXCEPTION: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'UNHANDLED_EXCEPTION',
    errorMsg: 'An unhandled exception occurred.',
  },
  INTERNAL_SERVER_ERROR: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_SERVER_ERROR',
    errorMsg: 'An internal server error occurred.',
  },
  ROL_NOT_FOUND: {
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'ROL_NOT_FOUND',
    errorMsg: 'Rol not found.',
  },
  PERMISSION_ALREADY_ASSIGNED: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'PERMISSION_ALREADY_ASSIGNED',
    errorMsg: 'Permission already assigned.',
  },
  USER_ALREADY_EXISTS: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'USER_ALREADY_EXISTS',
    errorMsg: 'User already exists.',
  },
  INACTIVE_USER: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'INACTIVE_USER',
    errorMsg: 'User is inactive.',
  },
  CHANNEL_NOT_FOUND: {
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'CHANNEL_NOT_FOUND',
    errorMsg: 'Channel not found.',
  },
  CONFIG_NOT_FOUND: {
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'CONFIG_NOT_FOUND',
    errorMsg: 'Configuration not found.',
  },
  PASSWORD_HAS_BEEN_UPDATED: {
    httpStatus: HttpStatus.CONFLICT,
    code: 'PASSWORD_HAS_BEEN_UPDATED',
    errorMsg: 'Password has been updated.',
  },
  BAD_REQUEST: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'BAD_REQUEST',
    errorMsg: 'Bad request.',
  },
  INVALID_FORWARD: {
    httpStatus: HttpStatus.CONFLICT,
    code: 'INVALID_FORWARD',
    errorMsg: 'Invalid forward detected.',
  },
  INVALID_ECOMMERCE_TYPE: {
    httpStatus: HttpStatus.CONFLICT,
    code: 'INVALID_ECOMMERCE_TYPE',
    errorMsg: 'Invalid ecommerce type.',
  },
  DATABASE_ERROR: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'DATABASE_ERROR',
    errorMsg: 'Database error.',
  },
  CHANNEL_ALREADY_EXISTS: {
    httpStatus: HttpStatus.CONFLICT,
    code: 'CHANNEL_ALREADY_EXISTS',
    errorMsg: 'Channel already exists.',
  },
  SYNCHRONIZATION_ALREADY_IN_PROGRESS: {
    httpStatus: HttpStatus.CONFLICT,
    code: 'SYNCHRONIZATION_ALREADY_IN_PROGRESS',
    errorMsg: 'Synchronization already in progress.',
  },
  SKU_ERP_ALREADY_EXISTS: {
    httpStatus: HttpStatus.CONFLICT,
    code: 'SKU_ERP_ALREADY_EXISTS',
    errorMsg: 'SKU ERP already exists.',
  },
  ERROR_IN_COMMUNICATION_WITH_ERP: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'ERROR_IN_COMMUNICATION_WITH_ERP',
    errorMsg: 'Error in communication with the ERP.',
  },
  ERROR_SETTING_PRICE_PERMISSION: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'ERROR_SETTING_PRICE_PERMISSION',
    errorMsg: 'Error setting price permission in ERP.',
  },
  NO_RESPONSE_FROM_ERP: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'NO_RESPONSE_FROM_ERP',
    errorMsg: 'No response from the ERP.',
  },
  NO_SKUS_TO_VALIDATE: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'NO_SKUS_TO_VALIDATE',
    errorMsg: 'No skus to validate.',
  },
  FAILED_TO_GENERATE_TOKEN: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'FAILED_TO_GENERATE_TOKEN',
    errorMsg: 'Failed to generate token.',
  },
  AUTH_CODE_EXPIRED: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'AUTH_CODE_EXPIRED',
    errorMsg: 'Auth code expired.',
  },
  FAILED_TO_SUBSCRIBE_WEBHOOK: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'FAILED_TO_SUBSCRIBE_WEBHOOK',
    errorMsg: 'Failed to subscribe webhook.',
  },
  FAILED_INVALID_CREDENTIALS: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'FAILED_INVALID_CREDENTIALS',
    errorMsg: 'Invalid credentials.',
  },
  CHANNEL_HAS_ORDERS: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'CHANNEL_HAS_ORDERS',
    errorMsg: 'Channel has orders.',
  },
  CHANNEL_SHORT_ID_GENERATION_FAILED: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'CHANNEL_SHORT_ID_GENERATION_FAILED',
    errorMsg: 'Failed to generate unique short ID for channel.',
  },
  ACCOUNT_SETTINGS_NOT_FOUND: {
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'ACCOUNT_SETTINGS_NOT_FOUND',
    errorMsg: 'Account settings not found.',
  },
  LOGISTIC_PROVIDER_CREDENTIALS_NOT_FOUND: {
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'LOGISTIC_PROVIDER_CREDENTIALS_NOT_FOUND',
    errorMsg: 'Logistic provider credentials not found.',
  },
  FAILED_TO_SYNC_CHANNEL_CONFIGURATION_ERP: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'BAD_REQUEST',
    errorMsg: 'Failed to sync channel configuration ERP.',
  },
  CONTACT_NOT_FOUND: {
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'CONTACT_NOT_FOUND',
    errorMsg: 'Contact not found.',
  },
  CONTACT_ALREADY_EXISTS: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'CONTACT_ALREADY_EXISTS',
    errorMsg: 'Contact with this email already exists for this user.',
  },
  NOTIFICATION_TYPE_NOT_FOUND: {
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'NOTIFICATION_TYPE_NOT_FOUND',
    errorMsg: 'Notification type not found.',
  },
  NOTIFICATION_PREFERENCE_NOT_FOUND: {
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'NOTIFICATION_PREFERENCE_NOT_FOUND',
    errorMsg: 'Notification preference not found.',
  },
  ERROR_GETTING_SHIPPING_STOPPAGE_REASONS: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'ERROR_GETTING_SHIPPING_STOPPAGE_REASONS',
    errorMsg: 'Error getting shipping stoppage reasons from ERP.',
  },
};

