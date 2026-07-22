import {
  AuditAction,
  AuditOrigin,
  CatalogItemStatus,
  ChannelIntegratorType,
  Currency,
  EcommerceTypes,
  FfType,
  FfTypeItem,
  OrderStatus,
  PrismaClient,
  ShipmentOrigin,
} from '@prisma/client';

const prisma = new PrismaClient();

// IDs para datos de prueba (se generan dinámicamente para evitar conflictos)
const TEST_PRODUCT_IDS: string[] = [];
const TEST_ORDER_IDS: string[] = [];

// Email del usuario de prueba (constante para identificar datos de prueba)
const TEST_USER_EMAIL = 'test-audit@promologistics.com.mx';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

// Helper: Crear usuario de prueba
async function createTestUser() {
  // Buscar el rol "Fulfillment" específicamente
  const role = await prisma.rol.findUnique({
    where: { name: 'Fulfillment' },
  });

  if (!role) {
    throw new Error(
      'No se encontró el rol "Fulfillment" para el usuario de prueba',
    );
  }

  // Verificar si el usuario ya existe
  const existingUser = await prisma.user.findUnique({
    where: { email: TEST_USER_EMAIL },
  });

  if (existingUser) {
    console.log('✓ Usuario de prueba ya existe, usando existente');
    return existingUser;
  }

  // Crear con ID único basado en email (para idempotencia)
  const user = await prisma.user.create({
    data: {
      email: TEST_USER_EMAIL,
      name: 'Test Audit User',
      password: '$2b$10$LeSt3oySoG7N93rXafqWk.z4Td1A7CHKJNvF2sJVnZNwm8At9lM5e',
      status: 'ACTIVE',
      createdBy: 'test-script',
      roleId: role.id,
    },
  });

  console.log('✓ Usuario de prueba creado:', user.email);
  return user;
}

// Helper: Crear integrador Yuju de prueba
async function createTestIntegrator(userId: string) {
  // Verificar si el integrador ya existe para este usuario
  const existingIntegrator = await prisma.channelIntegrator.findFirst({
    where: {
      userId,
      name: 'Test Yuju Integrator',
      type: ChannelIntegratorType.YUJU,
      deletedAt: null,
    },
  });

  if (existingIntegrator) {
    console.log('✓ Integrador de prueba ya existe, usando existente');
    return existingIntegrator;
  }

  // Crear con ID único basado en timestamp
  const uniqueId = `test-integrator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const shortId = `TEST-YUJU-${Date.now().toString().substring(0, 10)}`;

  const integrator = await prisma.channelIntegrator.create({
    data: {
      id: uniqueId,
      shortId,
      name: 'Test Yuju Integrator',
      type: ChannelIntegratorType.YUJU,
      config: {
        token: 'test-yuju-token-' + Date.now(),
        webhook: {
          url: 'https://test.example.com/webhook',
        },
      },
      isActive: true,
      userId,
      createdBy: 'test-script',
    },
  });

  console.log('✓ Integrador Yuju de prueba creado:', integrator.name);
  return integrator;
}

// Helper: Crear canal de prueba asociado al integrador Yuju
async function createTestChannel(userId: string, integratorId: string) {
  // Usar directamente el enum EcommerceTypes.YMELI (MercadoLibre vía Yuju)
  // No necesitamos buscar en la tabla ecommerce ya que el campo acepta directamente el enum

  // Verificar si el canal ya existe para este integrador
  const existingChannel = await prisma.channel.findFirst({
    where: {
      userId,
      channelIntegratorId: integratorId,
      name: 'Test Audit Channel (Yuju)',
      deletedAt: null,
    },
  });

  if (existingChannel) {
    console.log('✓ Canal de prueba ya existe, usando existente');
    return existingChannel;
  }

  // Crear con ID único
  const uniqueId = `test-channel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const channel = await prisma.channel.create({
    data: {
      id: uniqueId,
      shortId: `TEST-${Date.now()}`,
      name: 'Test Audit Channel (Yuju)',
      userId,
      channelIntegratorId: integratorId,
      ecommerceType: EcommerceTypes.YMELI, // MercadoLibre vía Yuju
      initialDate: new Date(),
      partnerId: `test-partner-${Date.now()}`,
      orderDownloadOption: 'ALL',
      isConnect: true,
      isCredentials: false,
      createdBy: 'test-script',
    },
  });

  console.log('✓ Canal de prueba (Yuju) creado:', channel.name);
  return channel;
}

// Helper: Crear producto de prueba (simulando que viene de Yuju)
async function createTestProduct(
  userId: string,
  channelId: string,
  skuChannel: string,
  skuErp: string,
  ffTypeItem: FfTypeItem = 'fbm',
  productId?: string,
) {
  const product = await prisma.catalogItem.create({
    data: {
      name: `Test Product ${skuChannel}`,
      productId:
        productId ||
        `YUJU-PROD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      skuChannel,
      skuErp,
      originType: 'ORDER_ITEM', // Simula que viene de una orden de Yuju
      ffTypeItem,
      channelId,
      userId,
      status: CatalogItemStatus.SUCCESS,
      createdBy: 'YUJU', // Simula creación desde Yuju
    },
  });

  TEST_PRODUCT_IDS.push(product.id);
  console.log(
    `✓ Producto de prueba (Yuju) creado: ${product.name} (${product.id})`,
  );
  return product;
}

// Helper: Crear orden de prueba (simulando que viene de Yuju)
// Nota: El evento ORDER_CREATED debe registrarse manualmente después de crear la orden
async function createTestOrder(
  channelId: string,
  status: OrderStatus = OrderStatus.IN_EVALUATION,
  skuChannel?: string,
) {
  const orderId = `test-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const ecommerceOrderId = `YUJU-ORDER-${Date.now()}`;

  const order = await prisma.channelOrder.create({
    data: {
      id: orderId,
      channelId,
      status,
      statusDetail: {},
      guideTrackingDetail: {},
      ecommerceOrderId,
      ecommerceOrderStatus: 'pending',
      createdAtEcommerce: new Date(),
      total: 100.0,
      currency: Currency.MXN,
      ffType: FfType.fbm,
      shipmentOrigin: ShipmentOrigin.YUJU, // Orden viene de Yuju
      createdBy: 'YUJU', // Simula creación desde Yuju
      items: {
        create: [
          {
            name: 'Test Item from Yuju',
            sku: skuChannel || `YUJU-SKU-${Date.now()}`,
            quantity: 1,
            unitPrice: 100.0,
            totalPrice: 100.0,
            ffType: FfType.fbm,
            createdBy: 'YUJU', // Simula creación desde Yuju
          },
        ],
      },
    },
  });

  TEST_ORDER_IDS.push(order.id);
  console.log(
    `✓ Orden de prueba (Yuju) creada: ${order.ecommerceOrderId} (${order.id})`,
  );
  return order;
}

// Helper: Verificar evento en audit_log
async function verifyAuditLog(
  entityType: 'product' | 'order',
  entityId: string,
  action: AuditAction,
  expectedOrigin: AuditOrigin,
  expectedPreviousValue?: any,
  expectedNewValue?: any,
): Promise<boolean> {
  const logs = await prisma.auditLog.findMany({
    where: {
      entityType,
      entityId,
      action,
      origin: expectedOrigin,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
  });

  if (logs.length === 0) {
    return false;
  }

  const log = logs[0];

  if (expectedPreviousValue !== undefined) {
    const prevValue =
      typeof log.previousValue === 'object' && log.previousValue !== null
        ? JSON.stringify(log.previousValue)
        : log.previousValue;
    const expectedPrev =
      typeof expectedPreviousValue === 'object'
        ? JSON.stringify(expectedPreviousValue)
        : expectedPreviousValue;
    if (prevValue !== expectedPrev) {
      return false;
    }
  }

  if (expectedNewValue !== undefined) {
    const newValue =
      typeof log.newValue === 'object' && log.newValue !== null
        ? JSON.stringify(log.newValue)
        : log.newValue;
    const expectedNew =
      typeof expectedNewValue === 'object'
        ? JSON.stringify(expectedNewValue)
        : expectedNewValue;
    if (newValue !== expectedNew) {
      return false;
    }
  }

  return true;
}

// Helper: Verificar proceso en process_log
async function verifyProcessLog(
  processType: string,
  relatedId: string,
  expectedStatus: string,
): Promise<boolean> {
  const logs = await prisma.processLog.findMany({
    where: {
      processType: processType as any,
      relatedId,
      status: expectedStatus as any,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
  });

  return logs.length > 0;
}

// Test 1: PRODUCT_FFTYPE_CHANGED
async function testProductFfTypeChange() {
  const testName = 'PRODUCT_FFTYPE_CHANGED';
  console.log(`\n🧪 Ejecutando test: ${testName}`);

  try {
    const user = await createTestUser();
    const integrator = await createTestIntegrator(user.id);
    const channel = await createTestChannel(user.id, integrator.id);
    const product = await createTestProduct(
      user.id,
      channel.id,
      'YUJU-SKU-FBM-001',
      'ERP-SKU-001',
      'fbm',
    );

    // Crear orden relacionada con el producto (simulando que viene de Yuju)
    const order = await createTestOrder(
      channel.id,
      OrderStatus.IN_EVALUATION,
      'YUJU-SKU-FBM-001',
    );

    // Crear instancias simples de los repositorios y servicios
    const { AuditLogRepoService } = await import(
      '../libs/database/src/repository/audit-log-repo.service'
    );
    const { ChannelOrderItemRepoService } = await import(
      '../libs/database/src/repository/channel-order-item-repo.service'
    );
    const { AuditLogService } = await import(
      '../libs/common/src/services/audit-log.service'
    );
    const { LogService } = await import('../libs/log/src/log.service');

    // Crear instancias simples
    const auditLogRepo = new AuditLogRepoService(prisma as any);
    const channelOrderItemRepo = new ChannelOrderItemRepoService(prisma as any);
    const logService = new LogService();
    const auditLogService = new AuditLogService(
      auditLogRepo,
      channelOrderItemRepo,
      prisma as any,
      logService,
    );

    // Obtener valor anterior
    const previousFfType = product.ffTypeItem;

    // Cambiar ffTypeItem
    await prisma.catalogItem.update({
      where: { id: product.id },
      data: { ffTypeItem: 'fbc' },
    });

    // Registrar el cambio usando el servicio
    await auditLogService.logProductFfTypeChange(
      product.id,
      previousFfType,
      'fbc',
      AuditOrigin.USER,
      user.id,
    );

    // Verificar evento en producto
    const productLogExists = await verifyAuditLog(
      'product',
      product.id,
      AuditAction.PRODUCT_FFTYPE_CHANGED,
      AuditOrigin.USER,
      previousFfType,
      'fbc',
    );

    // Verificar evento en orden relacionada
    const orderLogExists = await verifyAuditLog(
      'order',
      order.id,
      AuditAction.PRODUCT_FFTYPE_CHANGED,
      AuditOrigin.USER,
    );

    if (productLogExists && orderLogExists) {
      results.push({
        name: testName,
        passed: true,
        details: {
          productId: product.id,
          orderId: order.id,
          previousValue: previousFfType,
          newValue: 'fbc',
        },
      });
      console.log(`✓ Test ${testName} PASÓ`);
    } else {
      throw new Error(
        `Eventos no encontrados. Product: ${productLogExists}, Order: ${orderLogExists}`,
      );
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`✗ Test ${testName} FALLÓ: ${error.message}`);
  }
}

// Test 2: ORDER_STATUS_CHANGED - Línea de tiempo completa de estados
async function testOrderStatusChange() {
  const testName = 'ORDER_STATUS_CHANGED';
  console.log(`\n🧪 Ejecutando test: ${testName}`);

  try {
    const user = await createTestUser();
    const integrator = await createTestIntegrator(user.id);
    const channel = await createTestChannel(user.id, integrator.id);

    // Crear orden inicialmente en IN_EVALUATION
    const order = await createTestOrder(channel.id, OrderStatus.IN_EVALUATION);

    // Crear instancias de servicios
    const { AuditLogRepoService } = await import(
      '../libs/database/src/repository/audit-log-repo.service'
    );
    const { ChannelOrderItemRepoService } = await import(
      '../libs/database/src/repository/channel-order-item-repo.service'
    );
    const { AuditLogService } = await import(
      '../libs/common/src/services/audit-log.service'
    );
    const { LogService } = await import('../libs/log/src/log.service');

    const auditLogRepo = new AuditLogRepoService(prisma as any);
    const channelOrderItemRepo = new ChannelOrderItemRepoService(prisma as any);
    const logService = new LogService();
    const auditLogService = new AuditLogService(
      auditLogRepo,
      channelOrderItemRepo,
      prisma as any,
      logService,
    );

    // Registrar creación de orden (ORDER_CREATED)
    await auditLogService.logOrderCreation(
      order.id,
      {
        ecommerceOrderId: order.ecommerceOrderId,
        status: order.status,
        total: Number(order.total),
        channelId: order.channelId,
      },
      AuditOrigin.SYSTEM,
    );

    // Paso 1: IN_EVALUATION → PENDING
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { status: OrderStatus.PENDING },
    });
    await auditLogService.logOrderStatusChange(
      order.id,
      OrderStatus.IN_EVALUATION,
      OrderStatus.PENDING,
      AuditOrigin.SYSTEM,
    );

    // Paso 2: PENDING → IN_PROCESS
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { status: OrderStatus.IN_PROCESS },
    });
    await auditLogService.logOrderStatusChange(
      order.id,
      OrderStatus.PENDING,
      OrderStatus.IN_PROCESS,
      AuditOrigin.SYSTEM,
    );

    // Verificar eventos - buscar directamente el log de ORDER_CREATED
    const createdLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'order',
        entityId: order.id,
        action: 'ORDER_CREATED' as any,
        origin: AuditOrigin.SYSTEM,
      },
    });
    const createdLog =
      createdLogs.length > 0 &&
      (createdLogs[0].newValue as any) === 'Orden creada';

    // Buscar todos los logs de cambio de estado
    const allStatusLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'order',
        entityId: order.id,
        action: AuditAction.ORDER_STATUS_CHANGED,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Verificar que existan los cambios esperados
    const pendingLog = allStatusLogs.find(
      (log) =>
        (log.previousValue as any) === OrderStatus.IN_EVALUATION &&
        (log.newValue as any) === OrderStatus.PENDING,
    );
    const inProcessLog = allStatusLogs.find(
      (log) =>
        (log.previousValue as any) === OrderStatus.PENDING &&
        (log.newValue as any) === OrderStatus.IN_PROCESS,
    );

    if (createdLog && pendingLog && inProcessLog && allStatusLogs.length >= 2) {
      results.push({
        name: testName,
        passed: true,
        details: {
          orderId: order.id,
          eventsCreated: allStatusLogs.length + 1, // +1 por ORDER_CREATED
          statusTransitions: [
            { from: OrderStatus.IN_EVALUATION, to: OrderStatus.PENDING },
            { from: OrderStatus.PENDING, to: OrderStatus.IN_PROCESS },
          ],
        },
      });
      console.log(
        `✓ Test ${testName} PASÓ - ${allStatusLogs.length + 1} eventos creados`,
      );
    } else {
      throw new Error(
        `Eventos incompletos. Created: ${createdLog}, Pending: ${pendingLog}, InProcess: ${inProcessLog}, Total: ${allStatusLogs.length}`,
      );
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`✗ Test ${testName} FALLÓ: ${error.message}`);
  }
}

// Test 3: ORDER_SUBSTATUS_CHANGED - Múltiples warnings a lo largo del tiempo
async function testOrderSubstatusChange() {
  const testName = 'ORDER_SUBSTATUS_CHANGED';
  console.log(`\n🧪 Ejecutando test: ${testName}`);

  try {
    const user = await createTestUser();
    const integrator = await createTestIntegrator(user.id);
    const channel = await createTestChannel(user.id, integrator.id);
    const order = await createTestOrder(channel.id, OrderStatus.IN_EVALUATION);

    // Crear instancias de servicios
    const { AuditLogRepoService } = await import(
      '../libs/database/src/repository/audit-log-repo.service'
    );
    const { ChannelOrderItemRepoService } = await import(
      '../libs/database/src/repository/channel-order-item-repo.service'
    );
    const { AuditLogService } = await import(
      '../libs/common/src/services/audit-log.service'
    );
    const { LogService } = await import('../libs/log/src/log.service');

    const auditLogRepo = new AuditLogRepoService(prisma as any);
    const channelOrderItemRepo = new ChannelOrderItemRepoService(prisma as any);
    const logService = new LogService();
    const auditLogService = new AuditLogService(
      auditLogRepo,
      channelOrderItemRepo,
      prisma as any,
      logService,
    );

    let previousStatusDetail: any = {};

    // Paso 1: Agregar warning de SKU faltante
    const statusDetailWithMissingSku = {
      missing_sku: 'Se encontraron productos sin el SKU del ERP',
    };
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { statusDetail: statusDetailWithMissingSku },
    });
    await auditLogService.logOrderSubstatusChange(
      order.id,
      previousStatusDetail,
      statusDetailWithMissingSku,
      AuditOrigin.SYSTEM,
    );
    previousStatusDetail = statusDetailWithMissingSku;

    // Paso 2: Agregar warning de inventario (sin remover el anterior)
    const statusDetailWithInventory = {
      ...previousStatusDetail,
      erp_item_inventory_message: 'No hay suficiente inventario disponible',
    };
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { statusDetail: statusDetailWithInventory },
    });
    await auditLogService.logOrderSubstatusChange(
      order.id,
      previousStatusDetail,
      statusDetailWithInventory,
      AuditOrigin.SYSTEM,
    );
    previousStatusDetail = statusDetailWithInventory;

    // Paso 3: Agregar warning de guía faltante
    const statusDetailWithGuide = {
      ...previousStatusDetail,
      yuju_guide_fetch_error: 'No se pudo obtener la guía de envío de Yuju',
    };
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { statusDetail: statusDetailWithGuide },
    });
    await auditLogService.logOrderSubstatusChange(
      order.id,
      previousStatusDetail,
      statusDetailWithGuide,
      AuditOrigin.SYSTEM,
    );
    previousStatusDetail = statusDetailWithGuide;

    // Paso 4: Resolver warning de SKU (removerlo)
    const statusDetailResolvedSku = {
      erp_item_inventory_message:
        previousStatusDetail.erp_item_inventory_message,
      yuju_guide_fetch_error: previousStatusDetail.yuju_guide_fetch_error,
    };
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { statusDetail: statusDetailResolvedSku },
    });
    await auditLogService.logOrderSubstatusChange(
      order.id,
      previousStatusDetail,
      statusDetailResolvedSku,
      AuditOrigin.SYSTEM,
    );

    // Verificar eventos
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'order',
        entityId: order.id,
        action: AuditAction.ORDER_SUBSTATUS_CHANGED,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (logs.length >= 4) {
      results.push({
        name: testName,
        passed: true,
        details: {
          orderId: order.id,
          logsFound: logs.length,
          warningsAdded: 3,
          warningsResolved: 1,
        },
      });
      console.log(
        `✓ Test ${testName} PASÓ - ${logs.length} eventos de subestatus creados`,
      );
    } else {
      throw new Error(
        `Eventos insuficientes. Esperados: 4, Encontrados: ${logs.length}`,
      );
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`✗ Test ${testName} FALLÓ: ${error.message}`);
  }
}

// Test 4: ORDER_GUIDE_UPDATED - Actualización de guía con resolución de warning
async function testOrderGuideUpdate() {
  const testName = 'ORDER_GUIDE_UPDATED';
  console.log(`\n🧪 Ejecutando test: ${testName}`);

  try {
    const user = await createTestUser();
    const integrator = await createTestIntegrator(user.id);
    const channel = await createTestChannel(user.id, integrator.id);
    const order = await createTestOrder(
      channel.id,
      OrderStatus.PENDING_SHIPPING,
    );

    // Crear instancias de servicios
    const { AuditLogRepoService } = await import(
      '../libs/database/src/repository/audit-log-repo.service'
    );
    const { ChannelOrderItemRepoService } = await import(
      '../libs/database/src/repository/channel-order-item-repo.service'
    );
    const { AuditLogService } = await import(
      '../libs/common/src/services/audit-log.service'
    );
    const { LogService } = await import('../libs/log/src/log.service');

    const auditLogRepo = new AuditLogRepoService(prisma as any);
    const channelOrderItemRepo = new ChannelOrderItemRepoService(prisma as any);
    const logService = new LogService();
    const auditLogService = new AuditLogService(
      auditLogRepo,
      channelOrderItemRepo,
      prisma as any,
      logService,
    );

    // Paso 1: Agregar warning de guía faltante
    const statusDetailWithGuideError = {
      yuju_guide_fetch_error: 'No se pudo obtener la guía de envío de Yuju',
    };
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { statusDetail: statusDetailWithGuideError },
    });
    await auditLogService.logOrderSubstatusChange(
      order.id,
      {},
      statusDetailWithGuideError,
      AuditOrigin.SYSTEM,
    );

    // Paso 2: Simular actualización de guía (resuelve el warning)
    const guideData = {
      trackingNumber: 'ABC123XYZ',
      guideUrl: 'https://example.com/guide.pdf',
      s3Key: 'guides/abc123xyz.pdf',
      downloadDate: new Date().toISOString(),
    };

    // Remover el warning al obtener la guía
    const statusDetailResolved = {};
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: {
        guideTrackingDetail: guideData,
        statusDetail: statusDetailResolved,
      },
    });

    // Registrar actualización de guía
    await auditLogService.logOrderGuideUpdate(
      order.id,
      guideData,
      AuditOrigin.SYSTEM,
    );

    // Registrar resolución del warning
    await auditLogService.logOrderSubstatusChange(
      order.id,
      statusDetailWithGuideError,
      statusDetailResolved,
      AuditOrigin.SYSTEM,
    );

    // Verificar eventos
    const guideLog = await verifyAuditLog(
      'order',
      order.id,
      AuditAction.ORDER_GUIDE_UPDATED,
      AuditOrigin.SYSTEM,
    );

    const substatusLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'order',
        entityId: order.id,
        action: AuditAction.ORDER_SUBSTATUS_CHANGED,
      },
    });

    if (guideLog && substatusLogs.length >= 2) {
      results.push({
        name: testName,
        passed: true,
        details: {
          orderId: order.id,
          guideData,
          substatusEvents: substatusLogs.length,
        },
      });
      console.log(
        `✓ Test ${testName} PASÓ - Guía actualizada y warning resuelto`,
      );
    } else {
      throw new Error(
        `Eventos incompletos. Guide: ${guideLog}, Substatus: ${substatusLogs.length}`,
      );
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`✗ Test ${testName} FALLÓ: ${error.message}`);
  }
}

// Test 5: ORDER_BUYER_UPDATED
async function testOrderBuyerUpdate() {
  const testName = 'ORDER_BUYER_UPDATED';
  console.log(`\n🧪 Ejecutando test: ${testName}`);

  try {
    const user = await createTestUser();
    const integrator = await createTestIntegrator(user.id);
    const channel = await createTestChannel(user.id, integrator.id);

    const previousBuyer = {
      name: 'Juan Pérez',
      phone: '1234567890',
      email: 'juan@example.com',
    };

    const order = await prisma.channelOrder.create({
      data: {
        id: `test-order-buyer-${Date.now()}`,
        channelId: channel.id,
        status: OrderStatus.IN_EVALUATION,
        statusDetail: {},
        guideTrackingDetail: {},
        ecommerceOrderId: `YUJU-BUYER-${Date.now()}`,
        ecommerceOrderStatus: 'pending',
        createdAtEcommerce: new Date(),
        total: 100.0,
        currency: Currency.MXN,
        ffType: FfType.fbm,
        shipmentOrigin: ShipmentOrigin.YUJU,
        recipient: previousBuyer,
        createdBy: 'YUJU',
      },
    });

    // Crear instancias de servicios
    const { AuditLogRepoService } = await import(
      '../libs/database/src/repository/audit-log-repo.service'
    );
    const { ChannelOrderItemRepoService } = await import(
      '../libs/database/src/repository/channel-order-item-repo.service'
    );
    const { AuditLogService } = await import(
      '../libs/common/src/services/audit-log.service'
    );
    const { LogService } = await import('../libs/log/src/log.service');

    const auditLogRepo = new AuditLogRepoService(prisma as any);
    const channelOrderItemRepo = new ChannelOrderItemRepoService(prisma as any);
    const logService = new LogService();
    const auditLogService = new AuditLogService(
      auditLogRepo,
      channelOrderItemRepo,
      prisma as any,
      logService,
    );

    // Actualizar comprador
    const newBuyer = {
      name: 'Pedro García',
      phone: '0987654321',
      email: 'pedro@example.com',
    };

    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { recipient: newBuyer },
    });

    // Registrar cambio
    await auditLogService.logOrderBuyerUpdate(
      order.id,
      previousBuyer,
      newBuyer,
      AuditOrigin.USER,
      user.id,
    );

    // Verificar evento
    const logExists = await verifyAuditLog(
      'order',
      order.id,
      AuditAction.ORDER_BUYER_UPDATED,
      AuditOrigin.USER,
    );

    if (logExists) {
      results.push({
        name: testName,
        passed: true,
        details: {
          orderId: order.id,
          previousBuyer,
          newBuyer,
        },
      });
      console.log(`✓ Test ${testName} PASÓ`);
    } else {
      throw new Error('Evento no encontrado');
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`✗ Test ${testName} FALLÓ: ${error.message}`);
  }
}

// Test 6: ORDER_ADDRESS_UPDATED
async function testOrderAddressUpdate() {
  const testName = 'ORDER_ADDRESS_UPDATED';
  console.log(`\n🧪 Ejecutando test: ${testName}`);

  try {
    const user = await createTestUser();
    const integrator = await createTestIntegrator(user.id);
    const channel = await createTestChannel(user.id, integrator.id);

    const previousAddress = {
      street: 'Calle Principal 123',
      number: '123',
      city: 'Ciudad de México',
      state: 'CDMX',
      zipCode: '12345',
      neighborhood: 'Centro',
      municipality: 'Miguel Hidalgo',
    };

    const order = await prisma.channelOrder.create({
      data: {
        id: `test-order-address-${Date.now()}`,
        channelId: channel.id,
        status: OrderStatus.IN_EVALUATION,
        statusDetail: {},
        guideTrackingDetail: {},
        ecommerceOrderId: `YUJU-ADDRESS-${Date.now()}`,
        ecommerceOrderStatus: 'pending',
        createdAtEcommerce: new Date(),
        total: 100.0,
        currency: Currency.MXN,
        ffType: FfType.fbm,
        shipmentOrigin: ShipmentOrigin.YUJU,
        recipientAddress: previousAddress,
        createdBy: 'YUJU',
      },
    });

    // Crear instancias de servicios
    const { AuditLogRepoService } = await import(
      '../libs/database/src/repository/audit-log-repo.service'
    );
    const { ChannelOrderItemRepoService } = await import(
      '../libs/database/src/repository/channel-order-item-repo.service'
    );
    const { AuditLogService } = await import(
      '../libs/common/src/services/audit-log.service'
    );
    const { LogService } = await import('../libs/log/src/log.service');

    const auditLogRepo = new AuditLogRepoService(prisma as any);
    const channelOrderItemRepo = new ChannelOrderItemRepoService(prisma as any);
    const logService = new LogService();
    const auditLogService = new AuditLogService(
      auditLogRepo,
      channelOrderItemRepo,
      prisma as any,
      logService,
    );

    // Actualizar dirección
    const newAddress = {
      street: 'Avenida Nueva 456',
      number: '456',
      city: 'Guadalajara',
      state: 'Jalisco',
      zipCode: '54321',
      neighborhood: 'Zona Centro',
      municipality: 'Guadalajara',
    };

    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { recipientAddress: newAddress },
    });

    // Registrar cambio
    await auditLogService.logOrderAddressUpdate(
      order.id,
      previousAddress,
      newAddress,
      AuditOrigin.USER,
      user.id,
    );

    // Verificar evento
    const logExists = await verifyAuditLog(
      'order',
      order.id,
      AuditAction.ORDER_ADDRESS_UPDATED,
      AuditOrigin.USER,
    );

    if (logExists) {
      results.push({
        name: testName,
        passed: true,
        details: {
          orderId: order.id,
          previousAddress,
          newAddress,
        },
      });
      console.log(`✓ Test ${testName} PASÓ`);
    } else {
      throw new Error('Evento no encontrado');
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`✗ Test ${testName} FALLÓ: ${error.message}`);
  }
}

// Test 7: ORDER_COMPLETE_TIMELINE - Línea de tiempo completa de una orden con múltiples eventos
async function testOrderCompleteTimeline() {
  const testName = 'ORDER_COMPLETE_TIMELINE';
  console.log(`\n🧪 Ejecutando test: ${testName}`);

  try {
    const user = await createTestUser();
    const integrator = await createTestIntegrator(user.id);
    const channel = await createTestChannel(user.id, integrator.id);
    const product = await createTestProduct(
      user.id,
      channel.id,
      'YUJU-SKU-TIMELINE-001',
      'ERP-SKU-TIMELINE-001',
      'fbm',
    );

    // Crear instancias de servicios
    const { AuditLogRepoService } = await import(
      '../libs/database/src/repository/audit-log-repo.service'
    );
    const { ChannelOrderItemRepoService } = await import(
      '../libs/database/src/repository/channel-order-item-repo.service'
    );
    const { AuditLogService } = await import(
      '../libs/common/src/services/audit-log.service'
    );
    const { LogService } = await import('../libs/log/src/log.service');

    const auditLogRepo = new AuditLogRepoService(prisma as any);
    const channelOrderItemRepo = new ChannelOrderItemRepoService(prisma as any);
    const logService = new LogService();
    const auditLogService = new AuditLogService(
      auditLogRepo,
      channelOrderItemRepo,
      prisma as any,
      logService,
    );

    // ===== LÍNEA DE TIEMPO COMPLETA =====

    // 1. CREAR ORDEN (ORDER_CREATED)
    const order = await createTestOrder(
      channel.id,
      OrderStatus.IN_EVALUATION,
      'YUJU-SKU-TIMELINE-001',
    );
    await auditLogService.logOrderCreation(
      order.id,
      {
        ecommerceOrderId: order.ecommerceOrderId,
        status: order.status,
        total: Number(order.total),
        channelId: order.channelId,
      },
      AuditOrigin.SYSTEM,
    );
    console.log('  → Paso 1: Orden creada (ORDER_CREATED)');

    // 2. CAMBIO DE ESTADO: IN_EVALUATION → PENDING
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { status: OrderStatus.PENDING },
    });
    await auditLogService.logOrderStatusChange(
      order.id,
      OrderStatus.IN_EVALUATION,
      OrderStatus.PENDING,
      AuditOrigin.SYSTEM,
    );
    console.log('  → Paso 2: Estado cambiado a PENDING');

    // 3. AGREGAR WARNING: Falta SKU
    let previousStatusDetail: any = {};
    const statusDetailWithMissingSku = {
      missing_sku: 'Se encontraron productos sin el SKU del ERP',
    };
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { statusDetail: statusDetailWithMissingSku },
    });
    await auditLogService.logOrderSubstatusChange(
      order.id,
      previousStatusDetail,
      statusDetailWithMissingSku,
      AuditOrigin.SYSTEM,
    );
    previousStatusDetail = statusDetailWithMissingSku;
    console.log('  → Paso 3: Warning agregado - Falta SKU');

    // 4. CAMBIO DE ESTADO: PENDING → IN_PROCESS
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { status: OrderStatus.IN_PROCESS },
    });
    await auditLogService.logOrderStatusChange(
      order.id,
      OrderStatus.PENDING,
      OrderStatus.IN_PROCESS,
      AuditOrigin.SYSTEM,
    );
    console.log('  → Paso 4: Estado cambiado a IN_PROCESS');

    // 5. AGREGAR WARNING: No hay inventario
    const statusDetailWithInventory = {
      ...previousStatusDetail,
      erp_item_inventory_message: 'No hay suficiente inventario disponible',
    };
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { statusDetail: statusDetailWithInventory },
    });
    await auditLogService.logOrderSubstatusChange(
      order.id,
      previousStatusDetail,
      statusDetailWithInventory,
      AuditOrigin.SYSTEM,
    );
    previousStatusDetail = statusDetailWithInventory;
    console.log('  → Paso 5: Warning agregado - Sin inventario');

    // 6. RESOLVER WARNING: SKU asignado
    const statusDetailResolvedSku = {
      erp_item_inventory_message:
        previousStatusDetail.erp_item_inventory_message,
    };
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { statusDetail: statusDetailResolvedSku },
    });
    await auditLogService.logOrderSubstatusChange(
      order.id,
      previousStatusDetail,
      statusDetailResolvedSku,
      AuditOrigin.SYSTEM,
    );
    previousStatusDetail = statusDetailResolvedSku;
    console.log('  → Paso 6: Warning resuelto - SKU asignado');

    // 7. CAMBIO DE ESTADO: IN_PROCESS → PENDING_SHIPPING
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { status: OrderStatus.PENDING_SHIPPING },
    });
    await auditLogService.logOrderStatusChange(
      order.id,
      OrderStatus.IN_PROCESS,
      OrderStatus.PENDING_SHIPPING,
      AuditOrigin.SYSTEM,
    );
    console.log('  → Paso 7: Estado cambiado a PENDING_SHIPPING');

    // 8. AGREGAR WARNING: Falta guía
    const statusDetailWithGuideError = {
      ...previousStatusDetail,
      yuju_guide_fetch_error: 'No se pudo obtener la guía de envío de Yuju',
    };
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { statusDetail: statusDetailWithGuideError },
    });
    await auditLogService.logOrderSubstatusChange(
      order.id,
      previousStatusDetail,
      statusDetailWithGuideError,
      AuditOrigin.SYSTEM,
    );
    previousStatusDetail = statusDetailWithGuideError;
    console.log('  → Paso 8: Warning agregado - Falta guía');

    // 9. ACTUALIZAR GUÍA (resuelve el warning)
    const guideData = {
      trackingNumber: 'TIMELINE123XYZ',
      guideUrl: 'https://example.com/guide-timeline.pdf',
      s3Key: 'guides/timeline123xyz.pdf',
      downloadDate: new Date().toISOString(),
    };
    const statusDetailResolvedGuide = {
      erp_item_inventory_message:
        previousStatusDetail.erp_item_inventory_message,
    };
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: {
        guideTrackingDetail: guideData,
        statusDetail: statusDetailResolvedGuide,
      },
    });
    await auditLogService.logOrderGuideUpdate(
      order.id,
      guideData,
      AuditOrigin.SYSTEM,
    );
    await auditLogService.logOrderSubstatusChange(
      order.id,
      previousStatusDetail,
      statusDetailResolvedGuide,
      AuditOrigin.SYSTEM,
    );
    console.log('  → Paso 9: Guía actualizada y warning resuelto');

    // 10. CAMBIO DE ESTADO: PENDING_SHIPPING → IN_TRANSIT
    await prisma.channelOrder.update({
      where: { id: order.id },
      data: { status: OrderStatus.IN_TRANSIT },
    });
    await auditLogService.logOrderStatusChange(
      order.id,
      OrderStatus.PENDING_SHIPPING,
      OrderStatus.IN_TRANSIT,
      AuditOrigin.SYSTEM,
    );
    console.log('  → Paso 10: Estado cambiado a IN_TRANSIT');

    // Verificar todos los eventos
    const allLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'order',
        entityId: order.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const createdLogs = allLogs.filter(
      (l) =>
        (l.action as string) === 'ORDER_CREATED' &&
        (l.newValue as any) === 'Orden creada',
    );
    const statusLogs = allLogs.filter(
      (l) => l.action === AuditAction.ORDER_STATUS_CHANGED,
    );
    const substatusLogs = allLogs.filter(
      (l) => l.action === AuditAction.ORDER_SUBSTATUS_CHANGED,
    );
    const guideLogs = allLogs.filter(
      (l) => l.action === AuditAction.ORDER_GUIDE_UPDATED,
    );

    const expectedEvents = {
      ORDER_CREATED: 1,
      ORDER_STATUS_CHANGED: 4, // 4 cambios de estado
      ORDER_SUBSTATUS_CHANGED: 5, // 3 agregados + 2 resueltos
      ORDER_GUIDE_UPDATED: 1,
    };

    const actualEvents = {
      ORDER_CREATED: createdLogs.length,
      ORDER_STATUS_CHANGED: statusLogs.length,
      ORDER_SUBSTATUS_CHANGED: substatusLogs.length,
      ORDER_GUIDE_UPDATED: guideLogs.length,
    };

    const totalExpected =
      expectedEvents.ORDER_CREATED +
      expectedEvents.ORDER_STATUS_CHANGED +
      expectedEvents.ORDER_SUBSTATUS_CHANGED +
      expectedEvents.ORDER_GUIDE_UPDATED;

    if (
      createdLogs.length >= expectedEvents.ORDER_CREATED &&
      statusLogs.length >= expectedEvents.ORDER_STATUS_CHANGED &&
      substatusLogs.length >= expectedEvents.ORDER_SUBSTATUS_CHANGED &&
      guideLogs.length >= expectedEvents.ORDER_GUIDE_UPDATED
    ) {
      results.push({
        name: testName,
        passed: true,
        details: {
          orderId: order.id,
          totalEvents: allLogs.length,
          expectedEvents,
          actualEvents,
          timeline: [
            '1. ORDER_CREATED',
            '2. IN_EVALUATION → PENDING',
            '3. Warning: missing_sku',
            '4. PENDING → IN_PROCESS',
            '5. Warning: erp_item_inventory_message',
            '6. Warning resuelto: missing_sku',
            '7. IN_PROCESS → PENDING_SHIPPING',
            '8. Warning: yuju_guide_fetch_error',
            '9. Guía actualizada + warning resuelto',
            '10. PENDING_SHIPPING → IN_TRANSIT',
          ],
        },
      });
      console.log(
        `✓ Test ${testName} PASÓ - ${allLogs.length} eventos en línea de tiempo completa`,
      );
    } else {
      throw new Error(
        `Eventos incompletos. Esperados: ${JSON.stringify(expectedEvents)}, Actuales: ${JSON.stringify(actualEvents)}`,
      );
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`✗ Test ${testName} FALLÓ: ${error.message}`);
  }
}

// Test 8: Process Logs
async function testProcessLogs() {
  const testName = 'PROCESS_LOGS';
  console.log(`\n🧪 Ejecutando test: ${testName}`);

  try {
    const user = await createTestUser();
    const integrator = await createTestIntegrator(user.id);
    const channel = await createTestChannel(user.id, integrator.id);
    const order = await createTestOrder(channel.id, OrderStatus.IN_EVALUATION);

    // Crear instancias de servicios
    const { ProcessLogRepoService } = await import(
      '../libs/database/src/repository/process-log-repo.service'
    );
    const { ProcessLogHistoryRepoService } = await import(
      '../libs/database/src/repository/process-log-history-repo.service'
    );
    const { ProcessLogService } = await import(
      '../libs/common/src/services/process-log.service'
    );
    const { LogService } = await import('../libs/log/src/log.service');

    const processLogRepo = new ProcessLogRepoService(prisma as any);
    const processLogHistoryRepo = new ProcessLogHistoryRepoService(
      prisma as any,
    );
    const logService = new LogService();
    const processLogService = new ProcessLogService(
      processLogRepo,
      processLogHistoryRepo,
      logService,
    );

    // Test SYNC_INVENTORY
    await processLogService.logSyncInventory(user.id, 'SUCCESS' as any);
    const syncSuccess = await verifyProcessLog(
      'SYNC_INVENTORY',
      user.id,
      'SUCCESS',
    );

    await processLogService.logSyncInventory(user.id, 'ERROR' as any, {
      message: 'Error de prueba',
    });
    const syncError = await verifyProcessLog(
      'SYNC_INVENTORY',
      user.id,
      'ERROR',
    );

    // Test SEND_TO_NEXT
    await processLogService.logSendToNext(order.id, 'SUCCESS' as any);
    const sendSuccess = await verifyProcessLog(
      'SEND_TO_NEXT',
      order.id,
      'SUCCESS',
    );

    await processLogService.logSendToNext(order.id, 'ERROR' as any, {
      message: 'Error al enviar a Next',
    });
    const sendError = await verifyProcessLog('SEND_TO_NEXT', order.id, 'ERROR');

    // Test DOWNLOAD_GUIDE
    await processLogService.logDownloadGuide(order.id, 'SUCCESS' as any);
    const downloadSuccess = await verifyProcessLog(
      'DOWNLOAD_GUIDE',
      order.id,
      'SUCCESS',
    );

    await processLogService.logDownloadGuide(order.id, 'ERROR' as any, {
      message: 'Error al descargar guía',
    });
    const downloadError = await verifyProcessLog(
      'DOWNLOAD_GUIDE',
      order.id,
      'ERROR',
    );

    const allPassed =
      syncSuccess &&
      syncError &&
      sendSuccess &&
      sendError &&
      downloadSuccess &&
      downloadError;

    if (allPassed) {
      results.push({
        name: testName,
        passed: true,
        details: {
          syncInventory: { success: syncSuccess, error: syncError },
          sendToNext: { success: sendSuccess, error: sendError },
          downloadGuide: { success: downloadSuccess, error: downloadError },
        },
      });
      console.log(`✓ Test ${testName} PASÓ`);
    } else {
      throw new Error(
        `Algunos procesos fallaron. Sync: ${syncSuccess}/${syncError}, Send: ${sendSuccess}/${sendError}, Download: ${downloadSuccess}/${downloadError}`,
      );
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`✗ Test ${testName} FALLÓ: ${error.message}`);
  }
}

// Función para limpiar datos de pruebas anteriores
async function cleanupPreviousTestData() {
  console.log('🧹 Limpiando datos de pruebas anteriores...\n');

  try {
    // Buscar usuario de prueba
    const testUser = await prisma.user.findUnique({
      where: { email: TEST_USER_EMAIL },
    });

    if (!testUser) {
      console.log(
        '✓ No se encontró usuario de prueba, no hay datos que limpiar',
      );
      return;
    }

    console.log(
      `✓ Usuario de prueba encontrado: ${testUser.email} (${testUser.id})`,
    );

    // 1. Buscar y eliminar órdenes del usuario de prueba
    // Buscar por canales del usuario o por patrones específicos
    const channels = await prisma.channel.findMany({
      where: {
        userId: testUser.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    const channelIds = channels.map((c) => c.id);

    // Buscar órdenes por canal o por patrones de ID/ecommerceOrderId
    const ordersToDelete = await prisma.channelOrder.findMany({
      where: {
        OR: [
          { channelId: { in: channelIds } },
          { id: { startsWith: 'test-order-' } },
          { ecommerceOrderId: { startsWith: 'YUJU-ORDER-' } },
          { createdBy: 'YUJU' },
        ],
      },
      select: { id: true },
    });

    const orderIds = ordersToDelete.map((o) => o.id);

    if (orderIds.length > 0) {
      console.log(`  → Encontradas ${orderIds.length} órdenes para eliminar`);

      // Eliminar items de órdenes primero (foreign key constraint)
      await prisma.channelOrderItem.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      console.log(`  ✓ Items de órdenes eliminados`);

      // Eliminar audit logs relacionados con órdenes
      await prisma.auditLog.deleteMany({
        where: {
          entityType: 'order',
          entityId: { in: orderIds },
        },
      });
      console.log(`  ✓ Audit logs de órdenes eliminados`);

      // Eliminar process logs relacionados con órdenes
      await prisma.processLog.deleteMany({
        where: { relatedId: { in: orderIds } },
      });
      console.log(`  ✓ Process logs de órdenes eliminados`);

      // Eliminar las órdenes
      await prisma.channelOrder.deleteMany({
        where: { id: { in: orderIds } },
      });
      console.log(`  ✓ Órdenes eliminadas`);
    } else {
      console.log(`  → No se encontraron órdenes para eliminar`);
    }

    // 2. Buscar y eliminar productos del usuario de prueba
    const productsToDelete = await prisma.catalogItem.findMany({
      where: {
        OR: [
          { userId: testUser.id },
          { productId: { startsWith: 'YUJU-PROD-' } },
          { createdBy: 'YUJU' },
          { skuChannel: { startsWith: 'YUJU-SKU-' } },
        ],
        deletedAt: null,
      },
      select: { id: true },
    });

    const productIds = productsToDelete.map((p) => p.id);

    if (productIds.length > 0) {
      console.log(
        `  → Encontrados ${productIds.length} productos para eliminar`,
      );

      // Eliminar audit logs relacionados con productos
      await prisma.auditLog.deleteMany({
        where: {
          entityType: 'product',
          entityId: { in: productIds },
        },
      });
      console.log(`  ✓ Audit logs de productos eliminados`);

      // Eliminar los productos (soft delete o hard delete)
      await prisma.catalogItem.deleteMany({
        where: { id: { in: productIds } },
      });
      console.log(`  ✓ Productos eliminados`);
    } else {
      console.log(`  → No se encontraron productos para eliminar`);
    }

    // 3. Limpiar audit logs huérfanos (por si acaso)
    const orphanAuditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'order', entityId: { startsWith: 'test-order-' } },
          { entityType: 'order', entityId: { startsWith: 'YUJU-ORDER-' } },
          { entityType: 'product', entityId: { startsWith: 'YUJU-PROD-' } },
        ],
      },
      select: { id: true },
    });

    if (orphanAuditLogs.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { id: { in: orphanAuditLogs.map((l) => l.id) } },
      });
      console.log(
        `  ✓ ${orphanAuditLogs.length} audit logs huérfanos eliminados`,
      );
    }

    // 4. Limpiar process logs huérfanos
    const orphanProcessLogs = await prisma.processLog.findMany({
      where: {
        OR: [
          { relatedId: { startsWith: 'test-order-' } },
          { relatedId: { startsWith: 'YUJU-ORDER-' } },
        ],
      },
      select: { id: true },
    });

    if (orphanProcessLogs.length > 0) {
      await prisma.processLog.deleteMany({
        where: { id: { in: orphanProcessLogs.map((l) => l.id) } },
      });
      console.log(
        `  ✓ ${orphanProcessLogs.length} process logs huérfanos eliminados`,
      );
    }

    console.log('\n✅ Limpieza completada\n');
  } catch (error: any) {
    console.error('⚠️  Error durante la limpieza:', error.message);
    // No lanzar error para continuar con las pruebas
  }
}

// Función principal
async function main() {
  console.log('🚀 Iniciando pruebas de bitácoras...\n');

  // Limpiar datos anteriores antes de comenzar
  await cleanupPreviousTestData();

  const startTime = Date.now();

  try {
    // Ejecutar todos los tests
    await testProductFfTypeChange();
    await testOrderStatusChange(); // Ahora incluye múltiples cambios de estado
    await testOrderSubstatusChange(); // Ahora incluye múltiples warnings
    await testOrderGuideUpdate(); // Ahora incluye resolución de warning
    await testOrderBuyerUpdate();
    await testOrderAddressUpdate();
    await testOrderCompleteTimeline(); // Test completo con línea de tiempo realista
    await testProcessLogs();

    // Mostrar resumen
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE PRUEBAS');
    console.log('='.repeat(60));

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    results.forEach((result) => {
      const icon = result.passed ? '✓' : '✗';
      const status = result.passed ? 'PASÓ' : 'FALLÓ';
      console.log(`${icon} ${result.name}: ${status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.details) {
        console.log(`   Detalles: ${JSON.stringify(result.details, null, 2)}`);
      }
    });

    console.log('\n' + '-'.repeat(60));
    console.log(`Total: ${results.length} tests`);
    console.log(`Pasaron: ${passed}`);
    console.log(`Fallaron: ${failed}`);
    console.log(`Tiempo: ${duration}s`);
    console.log('-'.repeat(60));

    if (failed > 0) {
      console.log('\n⚠️  Algunos tests fallaron. Revisa los errores arriba.');
      process.exit(1);
    } else {
      console.log('\n✅ Todos los tests pasaron exitosamente!');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Error fatal durante las pruebas:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
main();
