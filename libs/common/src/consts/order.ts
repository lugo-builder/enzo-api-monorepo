import { EcommerceOrderStatus } from '../enums';

/** Local order status for filters (schema may not include ChannelOrder) */
const ORDER_PENDING = 'PENDING';

export const orderErpWhere = {
  recipient: { not: null },
  recipientAddress: { not: null },
  channel: {
    channelConfigurationERP: { isNot: null },
    user: {
      OR: [
        {
          accountSettings: null,
        },
        {
          accountSettings: {
            isSkipToSendOrder: false,
          },
        },
      ],
    },
  },
  items: {
    every: { sku: { not: null } },
  },
  status: ORDER_PENDING,
};

export const TimeToRetry = {
  0: 5,
  1: 15,
  2: 60,
};

export const ExcludedStatuses = [
  EcommerceOrderStatus.cancelled,
  EcommerceOrderStatus.Canceled,
  EcommerceOrderStatus.REFUNDED,
  EcommerceOrderStatus.delivered,
  EcommerceOrderStatus.refunded,
  EcommerceOrderStatus.close,
  EcommerceOrderStatus.closed,
];
