export interface ItemDelivery {
  numero_parte: string;
  upc: string;
  descripcion: string;
  sku: string;
  cantidad: number;
}

export interface Delivery {
  estado_entrega: string;
  clave_estado_entrega: string;
  fecha_entrega: string;
  guia: string;
  id_entrega: number;
  id_medio: number;
  articulos_entrega: ItemDelivery[];
  medio: string;
}

export interface OrderDelivery {
  documento: string;
  correo: string;
  numero_orden: string;
  emision_pedido: string;
  entregas: Delivery[];
  cliente: string;
  serie_facturacion: string;
  estado_embarque: string;
  id_embarque: number;
  folio: number;
  clave_estado_embarque: string;
  clave_estado_pedido: string;
  id_pedido: number;
  estado_pedido: string;
}

export interface ResponseOrders {
  pedidos: OrderDelivery[];
}
