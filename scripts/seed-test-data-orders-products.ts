import {
  CatalogItemStatus,
  Currency,
  DownloadOrdersOptions,
  EcommerceOrderStatus,
  EcommerceTypes,
  FfType,
  FfTypeItem,
  OrderStatus,
  PrismaClient,
  ShipmentOrigin,
  SkusAssignmentType,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script para crear datos de prueba: usuarios, productos, órdenes e items
 * Ejecutar con: npx ts-node -r tsconfig-paths/register --transpile-only scripts/seed-test-data-orders-products.ts
 *
 * Este script crea:
 * - AccountSettings para usuarios existentes
 * - Canales de prueba
 * - Productos (CatalogItem) con diferentes SKUs
 * - Órdenes (ChannelOrder) con diferentes estados
 * - Items de órdenes (ChannelOrderItem) que relacionan órdenes con productos
 */

// Email del usuario de prueba
const TEST_USER_EMAIL = 'test-audit@promologistics.com.mx';

// IDs fijos para datos de prueba (para idempotencia)
const TEST_CHANNEL_ID = 'test-channel-001';
const TEST_PRODUCT_IDS = [
  'b31438a7-28de-4008-9e3d-33a8c4795144', // Producto principal del ejemplo
  'test-product-001',
  'test-product-002',
  'test-product-003',
  'test-product-004',
  'test-product-no-orders', // Producto SIN órdenes (para probar caso vacío)
];

// Datos de productos de prueba
const PRODUCTS_DATA = [
  {
    id: TEST_PRODUCT_IDS[0],
    name: 'Producto Principal - Laptop Dell XPS 15',
    skuChannel: 'LAP-DELL-XPS15-001',
    skuErp: 'ERP-LAP-DELL-XPS15',
    productId: 'PROD-LAP-DELL-XPS15',
    originType: 'MANUALLY',
  },
  {
    id: TEST_PRODUCT_IDS[1],
    name: 'Mouse Inalámbrico Logitech MX Master 3',
    skuChannel: 'MOU-LOG-MX3-001',
    skuErp: 'ERP-MOU-LOG-MX3',
    productId: 'PROD-MOU-LOG-MX3',
    originType: 'MANUALLY',
  },
  {
    id: TEST_PRODUCT_IDS[2],
    name: 'Teclado Mecánico RGB Corsair K95',
    skuChannel: 'TEC-COR-K95-001',
    skuErp: 'ERP-TEC-COR-K95',
    productId: 'PROD-TEC-COR-K95',
    originType: 'MANUALLY',
  },
  {
    id: TEST_PRODUCT_IDS[3],
    name: 'Monitor 4K Samsung 32 pulgadas',
    skuChannel: 'MON-SAM-32-4K-001',
    skuErp: 'ERP-MON-SAM-32-4K',
    productId: 'PROD-MON-SAM-32-4K',
    originType: 'MANUALLY',
  },
  {
    id: TEST_PRODUCT_IDS[4],
    name: 'Auriculares Sony WH-1000XM5',
    skuChannel: 'AUD-SON-WH1000XM5-001',
    skuErp: 'ERP-AUD-SON-WH1000XM5',
    productId: 'PROD-AUD-SON-WH1000XM5',
    originType: 'MANUALLY',
  },
  {
    id: TEST_PRODUCT_IDS[5],
    name: 'Producto Sin Órdenes - Webcam Logitech C920',
    skuChannel: 'WEB-LOG-C920-001',
    skuErp: 'ERP-WEB-LOG-C920',
    productId: 'PROD-WEB-LOG-C920',
    originType: 'MANUALLY',
  },
];

// Generar fecha aleatoria en los últimos 30 días
function randomDate(daysAgo: number = 30): Date {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysAgo);
  const randomHours = Math.floor(Math.random() * 24);
  const randomMinutes = Math.floor(Math.random() * 60);

  const date = new Date(now);
  date.setDate(date.getDate() - randomDays);
  date.setHours(date.getHours() - randomHours);
  date.setMinutes(date.getMinutes() - randomMinutes);

  return date;
}

// Generar ID de orden de ecommerce
function generateEcommerceOrderId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function seedTestData() {
  console.log('🌱 Iniciando creación de datos de prueba...\n');

  try {
    // 1. Buscar o crear usuario de prueba
    console.log('📋 Buscando/creando usuario de prueba...');
    let user = await prisma.user.findUnique({
      where: { email: TEST_USER_EMAIL },
    });

    if (!user) {
      // Buscar el rol "Fulfillment"
      const role = await prisma.rol.findUnique({
        where: { name: 'Fulfillment' },
      });

      if (!role) {
        throw new Error(
          'No se encontró el rol "Fulfillment". Ejecuta primero el seed principal: npx prisma db seed',
        );
      }

      // Crear el usuario
      user = await prisma.user.create({
        data: {
          email: TEST_USER_EMAIL,
          name: 'Test Audit User',
          password: '$2b$10$LeSt3oySoG7N93rXafqWk.z4Td1A7CHKJNvF2sJVnZNwm8At9lM5e',
          status: 'ACTIVE',
          createdBy: 'test-seed',
          roleId: role.id,
        },
      });
      console.log(`✓ Usuario creado: ${user.email}\n`);
    } else {
      console.log(`✓ Usuario encontrado: ${user.email}\n`);
    }

    const TEST_USER_ID = user.id;

    // 2. Crear o actualizar AccountSettings
    console.log('⚙️  Creando/actualizando AccountSettings...');
    // Verificar si la columna isSkipToSendOrder existe (si la migración está aplicada)
    const accountSettingsData: any = {
      skusAssignmentType: SkusAssignmentType.MANUALLY,
      enableAutomaticItemsCreationInErp: false,
      syncInventory: true,
      orderDownloadOption: DownloadOrdersOptions.ALL,
      isSyncErp: true,
      createdBy: 'test-seed',
    };

    // Intentar agregar isSkipToSendOrder solo si la migración está aplicada
    try {
      // Verificar si existe el campo consultando el schema
      const testQuery = await prisma.$queryRaw<Array<{ COLUMN_NAME: string }>>`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'account_settings' 
        AND COLUMN_NAME = 'isSkipToSendOrder'
      `;
      if (Array.isArray(testQuery) && testQuery.length > 0) {
        accountSettingsData.isSkipToSendOrder = false;
      }
    } catch (error) {
      // Si no se puede verificar, simplemente no incluir el campo
      console.log('  ⚠️  Campo isSkipToSendOrder no disponible (migración pendiente)');
    }

    const accountSettings = await prisma.accountSettings.upsert({
      where: { userId: TEST_USER_ID },
      update: accountSettingsData,
      create: {
        userId: TEST_USER_ID,
        ...accountSettingsData,
      },
    });
    console.log(`✓ AccountSettings creado/actualizado para ${user.email}\n`);

    // 3. Crear o obtener canal de prueba
    console.log('📺 Creando/obteniendo canal de prueba...');
    const channel = await prisma.channel.upsert({
      where: { id: TEST_CHANNEL_ID },
      update: {
        name: 'Canal de Prueba - Amazon',
        shortId: 'TEST-AMZN-001',
        ecommerceType: EcommerceTypes.AMZN,
        initialDate: new Date(),
        orderDownloadOption: DownloadOrdersOptions.ALL,
        partnerId: 'test-partner-001',
        user: {
          connect: { id: TEST_USER_ID },
        },
        isConnect: true,
        isCredentials: true,
        isSync: true,
        isSyncErp: true,
        createdBy: 'test-seed',
      },
      create: {
        id: TEST_CHANNEL_ID,
        name: 'Canal de Prueba - Amazon',
        shortId: 'TEST-AMZN-001',
        ecommerceType: EcommerceTypes.AMZN,
        initialDate: new Date(),
        orderDownloadOption: DownloadOrdersOptions.ALL,
        partnerId: 'test-partner-001',
        user: {
          connect: { id: TEST_USER_ID },
        },
        isConnect: true,
        isCredentials: true,
        isSync: true,
        isSyncErp: true,
        createdBy: 'test-seed',
      },
    });
    console.log(`✓ Canal creado/obtenido: ${channel.name}\n`);

    // 4. Crear productos (CatalogItem)
    console.log('📦 Creando productos...');
    const createdProducts = [];
    for (const productData of PRODUCTS_DATA) {
      const product = await prisma.catalogItem.upsert({
        where: { id: productData.id },
        update: {
          name: productData.name,
          skuChannel: productData.skuChannel,
          skuErp: productData.skuErp,
          productId: productData.productId,
          originType: productData.originType,
          status: CatalogItemStatus.SUCCESS,
          ffTypeItem: FfTypeItem.fbm,
          channelId: TEST_CHANNEL_ID,
          userId: TEST_USER_ID,
          createdBy: 'test-seed',
        },
        create: {
          id: productData.id,
          name: productData.name,
          skuChannel: productData.skuChannel,
          skuErp: productData.skuErp,
          productId: productData.productId,
          originType: productData.originType,
          status: CatalogItemStatus.SUCCESS,
          ffTypeItem: FfTypeItem.fbm,
          channelId: TEST_CHANNEL_ID,
          userId: TEST_USER_ID,
          createdBy: 'test-seed',
        },
      });
      createdProducts.push(product);
      console.log(`  ✓ ${product.name} (${product.skuChannel})`);
    }
    console.log(`\n✓ ${createdProducts.length} productos creados/actualizados\n`);

    // 5. Crear órdenes con diferentes estados
    console.log('📋 Creando órdenes de prueba...');
    const orderStatuses: OrderStatus[] = [
      OrderStatus.IN_EVALUATION,
      OrderStatus.PENDING,
      OrderStatus.IN_PROCESS,
      OrderStatus.PENDING_SHIPPING,
      OrderStatus.IN_TRANSIT,
      OrderStatus.DELIVERED,
      OrderStatus.WARNING,
      OrderStatus.FAILED,
      OrderStatus.CANCELED,
      OrderStatus.RETURNS,
    ];

    const createdOrders = [];
    const ordersToCreate = 50; // Crear 50 órdenes para tener más datos de prueba

    // Asegurar que tengamos al menos una orden de cada estado
    const statusDistribution: { status: OrderStatus; count: number }[] = [
      { status: OrderStatus.IN_EVALUATION, count: 8 },
      { status: OrderStatus.PENDING, count: 7 },
      { status: OrderStatus.IN_PROCESS, count: 6 },
      { status: OrderStatus.PENDING_SHIPPING, count: 5 },
      { status: OrderStatus.IN_TRANSIT, count: 6 },
      { status: OrderStatus.DELIVERED, count: 10 },
      { status: OrderStatus.WARNING, count: 4 },
      { status: OrderStatus.FAILED, count: 2 },
      { status: OrderStatus.CANCELED, count: 2 },
      { status: OrderStatus.RETURNS, count: 2 },
    ];

    let statusIndex = 0;
    let statusCounter = 0;

    for (let i = 0; i < ordersToCreate; i++) {
      const ecommerceOrderId = generateEcommerceOrderId();
      // Variar fechas: algunas recientes, algunas antiguas (últimos 90 días)
      const daysAgo = i < 20 ? Math.floor(Math.random() * 7) : Math.floor(Math.random() * 90);
      const createdAtEcommerce = randomDate(daysAgo);
      
      // Distribuir estados de manera controlada
      let status: OrderStatus;
      if (statusIndex < statusDistribution.length) {
        status = statusDistribution[statusIndex].status;
        statusCounter++;
        if (statusCounter >= statusDistribution[statusIndex].count) {
          statusIndex++;
          statusCounter = 0;
        }
      } else {
        // Si ya distribuimos todos, usar aleatorio
        status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
      }

      const order = await prisma.channelOrder.create({
        data: {
          channelId: TEST_CHANNEL_ID,
          status: status,
          ecommerceOrderId: ecommerceOrderId,
          ecommerceOrderStatus: EcommerceOrderStatus.PAID,
          createdAtEcommerce: createdAtEcommerce,
          updatedAtEcommerce: new Date(),
          // Variar montos: algunos pequeños, algunos grandes
          total: i < 10 
            ? Math.floor(Math.random() * 2000) + 200  // Órdenes pequeñas: 200-2200
            : i < 30
            ? Math.floor(Math.random() * 5000) + 500  // Órdenes medianas: 500-5500
            : Math.floor(Math.random() * 10000) + 2000, // Órdenes grandes: 2000-12000
          subTotal: Math.floor(Math.random() * 4500) + 450,
          taxes: Math.floor(Math.random() * 1000) + 50,
          extras: i % 5 === 0 ? Math.floor(Math.random() * 200) : 0, // Algunas con extras
          discounts: i % 7 === 0 ? Math.floor(Math.random() * 500) : 0, // Algunas con descuentos
          currency: i % 10 === 0 ? Currency.USD : Currency.MXN, // Algunas en USD
          ffType: FfType.fbm,
          shipmentOrigin: i % 3 === 0 ? ShipmentOrigin.NEXT : ShipmentOrigin.YUJU, // Variar origen
          recipient: {
            name: `Cliente Prueba ${i + 1}`,
            email: `cliente${i + 1}@test.com`,
            phone: `555${String(i + 1).padStart(7, '0')}`,
          },
          recipientAddress: {
            street: `Calle Test ${i + 1}`,
            number: `${i + 1}${i + 1}`,
            city: 'Ciudad de México',
            state: 'CDMX',
            country: 'México',
            zipCode: `0${String(i + 1).padStart(4, '0')}`,
            neighborhood: 'Colonia Test',
            municipality: 'Delegación Test',
          },
          createdAt: createdAtEcommerce,
          createdBy: 'test-seed',
        },
      });
      createdOrders.push(order);
      console.log(
        `  ✓ Orden ${order.ecommerceOrderId} - Estado: ${order.status}`,
      );
    }
    console.log(`\n✓ ${createdOrders.length} órdenes creadas\n`);

    // 6. Crear items de órdenes que relacionen órdenes con productos
    console.log('🛒 Creando items de órdenes...');
    let totalItems = 0;

    // Filtrar productos: excluir el producto sin órdenes (último de la lista)
    const productsWithOrders = createdProducts.filter(
      (p) => p.id !== TEST_PRODUCT_IDS[5], // Excluir producto sin órdenes
    );

    for (const order of createdOrders) {
      // Cada orden tendrá entre 1 y 3 items
      const itemsPerOrder = Math.floor(Math.random() * 3) + 1;
      const selectedProducts = [];

      // Seleccionar productos aleatorios para esta orden (solo de los que deben tener órdenes)
      for (let i = 0; i < itemsPerOrder; i++) {
        const randomProduct =
          productsWithOrders[
            Math.floor(Math.random() * productsWithOrders.length)
          ];
        if (!selectedProducts.find((p) => p.id === randomProduct.id)) {
          selectedProducts.push(randomProduct);
        }
      }

      // Crear items para cada producto seleccionado
      for (const product of selectedProducts) {
        const quantity = Math.floor(Math.random() * 3) + 1; // Entre 1 y 3
        const unitPrice = Math.floor(Math.random() * 2000) + 200; // Entre 200 y 2200
        const totalPrice = unitPrice * quantity;

        await prisma.channelOrderItem.create({
          data: {
            orderId: order.id,
            ecommerceItemId: product.productId || `ECO-${product.id}`,
            ecommerceItemSku: product.skuChannel,
            name: product.name,
            sku: product.skuErp || product.skuChannel, // Usar SKU ERP si existe, sino SKU del canal
            quantity: quantity,
            unitPrice: unitPrice,
            totalPrice: totalPrice,
            taxRate: 0.16, // 16% IVA
            discount: 0,
            ffType: FfType.fbm,
            variantId: '0',
            inventoryId: '0',
            createdAt: order.createdAt || new Date(),
            createdBy: 'test-seed',
          },
        });
        totalItems++;
        console.log(
          `  ✓ Item: ${product.name} (x${quantity}) en orden ${order.ecommerceOrderId}`,
        );
      }
    }
    console.log(`\n✓ ${totalItems} items de órdenes creados\n`);

    // 7. Resumen
    console.log('📊 Resumen de datos creados:');
    console.log(`  - AccountSettings: 1`);
    console.log(`  - Canales: 1`);
    console.log(`  - Productos: ${createdProducts.length} (${productsWithOrders.length} con órdenes, 1 sin órdenes)`);
    console.log(`  - Órdenes: ${createdOrders.length}`);
    console.log(`  - Items de órdenes: ${totalItems}`);
    console.log('\n✅ Datos de prueba creados exitosamente!\n');

    // 8. Información útil
    console.log('🔍 Información útil para testing:');
    console.log(
      `  - Producto principal (del ejemplo): ${TEST_PRODUCT_IDS[0]}`,
    );
    console.log(
      `  - Producto SIN órdenes (para probar caso vacío): ${TEST_PRODUCT_IDS[5]}`,
    );
    console.log(`  - Canal ID: ${TEST_CHANNEL_ID}`);
    console.log(`  - Usuario: ${user.email} (ID: ${TEST_USER_ID})`);
    console.log('\n  Endpoints de prueba:');
    console.log(
      `  GET /orders/products/${TEST_PRODUCT_IDS[0]}?page=1&pageSize=10 (con órdenes)`,
    );
    console.log(
      `  GET /orders/products/${TEST_PRODUCT_IDS[5]}?page=1&pageSize=10 (sin órdenes - caso vacío)`,
    );
    console.log('\n  Filtros de prueba:');
    console.log(`  - Por estado: ?filters[status]=IN_EVALUATION`);
    console.log(`  - Por rango de fechas: ?filters[createdAt][gte]=2025-01-01&filters[createdAt][lte]=2025-01-31`);
    console.log(`  - Búsqueda global: ?globalFilter=ORD-123`);
    console.log(`  - Ordenamiento: ?sorting[0][id]=createdAt&sorting[0][desc]=true\n`);
  } catch (error) {
    console.error('❌ Error al crear datos de prueba:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el seed
seedTestData()
  .then(() => {
    console.log('✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el script:', error);
    process.exit(1);
  });
