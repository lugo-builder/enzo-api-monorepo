export const config = {
  defaultRol: process.env.DEFAULT_ROL || 'Fulfillment',
  defaultPassword: process.env.DEFAULT_PASSWORD || '$Promologi3tics',
  defaultAdmin: process.env.DEFAULT_ADMIN_ROL || 'Admin',
  frontUrl: process.env.FRONTEND_URL || 'http://localhost:5172',
  frontAdminUrl: process.env.FRONTEND_ADMIN_URL || 'http://localhost:5173',
  API_MKT_URL: process.env.API_MKT_URL || 'http://localhost:3001',
  API_SELLER_URL: process.env.API_SELLER_URL || 'https://api-seller.pakke.mx',
  NEXT_CLOUD_URL: process.env.NEXT_CLOUD_URL || 'https://api.next-cloud.mx/v1',
  MERCADO_LIBRE_CLIENT_ID: process.env.MERCADO_LIBRE_CLIENT_ID,
  MERCADO_LIBRE_CLIENT_SECRET: process.env.MERCADO_LIBRE_CLIENT_SECRET,
  DAYS_FOR_ORDER_VERIFICATION: process.env.DAYS_FOR_ORDER_VERIFICATION || 15,
  BUCKET_INVENTORY_FILES:
    process.env.BUCKET_INVENTORY_FILES?.trim() || 'f360sandbox-files',
  YUJU_QUEUE_URL: process.env.YUJU_QUEUE_URL,
  YUJU_MAX_RETRIES: parseInt(process.env.YUJU_MAX_RETRIES) || 0,
  YUJU_INITIAL_RETRY_DELAY:
    parseInt(process.env.YUJU_INITIAL_RETRY_DELAY) || 1000,
  YUJU_MAX_RETRY_DELAY: parseInt(process.env.YUJU_MAX_RETRY_DELAY) || 8000,
  YUJU_TIMEOUT_MS: parseInt(process.env.YUJU_TIMEOUT_MS) || 30000,
};
