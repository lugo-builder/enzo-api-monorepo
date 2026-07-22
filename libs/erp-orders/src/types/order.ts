import {
  AccountSettings,
  ChannelConfigurationERP,
  ChannelOrder,
  ChannelOrderItem,
  LogisticProviderCredentials,
  User
} from '@prisma/client';

export interface Order extends ChannelOrder {
  id: string;
  recipient: RecipientType;
  recipientAddress: RecipientAddressType;
  items: ChannelOrderItem[];
  channel: {
    channelConfigurationERP?: ChannelConfigurationERP;
    logisticProviderCredentials?: LogisticProviderCredentials;
    user?: User & {
      accountSettings?: AccountSettings & {
        logisticProviderCredentials?: LogisticProviderCredentials;
      };
    };
  };
  ecommerceOrderId: string;
  folioNext: string | null;
}

interface RecipientType {
  name: string;
  email: string;
  phone: string;
  [key: string]: any;
}

interface RecipientAddressType {
  [key: string]: any;
  street: string;
  number: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  neighborhood: string;
  municipality: string;
}
