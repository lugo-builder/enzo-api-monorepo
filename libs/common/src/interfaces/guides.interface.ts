/** Local types when Prisma schema does not include order/channel enums */
export type ShipmentOrigin = string;
export type EcommerceTypes = string;
export type OrderStatus = string;

export interface Delivery {
  [key: string]: unknown;
}

export interface OrderData {
  orderNumberErp: string;
  partnerId: string;
  ecommerceOrderId: string;
  shipmentOrigin: ShipmentOrigin;
  ecommerceType: EcommerceTypes;
  statusOrder: OrderStatus;
  delivery?: Delivery;
}
