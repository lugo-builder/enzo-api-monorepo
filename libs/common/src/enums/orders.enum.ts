export enum EcommerceOrderStatus {
  open = 'open',
  confirmed = 'confirmed',
  payment_required = 'payment_required',
  payment_in_process = 'payment_in_process',
  partially_paid = 'partially_paid',
  paid = 'paid',
  partially_refunded = 'partially_refunded',
  pending_cancel = 'pending_cancel',
  cancelled = 'cancelled',
  delivered = 'delivered',
  Shipped = 'Shipped',
  PendingAvailability = 'PendingAvailability',
  Pending = 'Pending',
  PartiallyShipped = 'PartiallyShipped',
  InvoiceUnconfirmed = 'InvoiceUnconfirmed',
  Canceled = 'Canceled',
  Unfulfillable = 'Unfulfillable',
  AUTHORIZED = 'AUTHORIZED',
  EXPIRED = 'EXPIRED',
  PAID = 'PAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  PENDING = 'PENDING',
  REFUNDED = 'REFUNDED',
  VOIDED = 'VOIDED',
  close = 'close',
  closed = 'closed',
  refunded = 'refunded',
}

export enum DeliveryStatusKey {
  IN_DISTRIBUTION = 'EA',
  IN_TRANSIT = 'EV',
  CONFIRMED = 'CF',
  CANCELED = 'C',
  CANCELED_BY_CREDIT = 'CR',
  REJECTED = 'ER',
  ASSIGNMENT_OF_WEIGHT = 'AW',
  DELIVERY_ON_FORWARDING = 'RE',
}

export enum FfType {
  FBM = 'fbm',
  FBC = 'fbc',
  MIX = 'mix',
}

export enum YujuStatus {
  OPEN = 'open',
  CLOSE = 'close',
}
