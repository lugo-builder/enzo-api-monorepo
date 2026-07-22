import { PrismaClient, ProcessLogType, ProcessStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script para crear registros de ejemplo de CANCEL_ORDER
 * Ejecutar con: npx ts-node scripts/seed-cancel-order-logs.ts
 */

// Razones de cancelación comunes
const CANCEL_REASONS = [
  'Cliente solicitó cancelación',
  'Producto fuera de stock',
  'Error en dirección de envío',
  'Pago rechazado',
  'Orden duplicada',
  'Cliente no respondió confirmación',
  'Problema con el proveedor',
  'Cambio de política de cancelación',
  'Error en procesamiento',
  'Solicitud del vendedor',
];

// Mensajes de error comunes
const ERROR_MESSAGES = [
  {
    code: 'NEXT_API_ERROR',
    message: 'Error al comunicarse con Next ERP',
    details: 'Timeout en la solicitud de cancelación',
  },
  {
    code: 'ORDER_NOT_FOUND',
    message: 'Orden no encontrada en Next ERP',
    details: 'La orden ya fue procesada o no existe',
  },
  {
    code: 'CANCELLATION_NOT_ALLOWED',
    message: 'La orden no puede ser cancelada',
    details: 'Estado actual de la orden no permite cancelación',
  },
  {
    code: 'NETWORK_ERROR',
    message: 'Error de conexión',
    details: 'No se pudo establecer conexión con el servidor',
  },
];

// Generar UUIDs de ejemplo para orderIds
function generateOrderId(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ORD-${result.toUpperCase()}`;
}

// Generar fecha aleatoria en los últimos 30 días
function randomDate(): Date {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 30);
  const hoursAgo = Math.floor(Math.random() * 24);
  const minutesAgo = Math.floor(Math.random() * 60);

  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - hoursAgo);
  date.setMinutes(date.getMinutes() - minutesAgo);

  return date;
}

async function seedCancelOrderLogs() {
  console.log(
    '🌱 Iniciando inserción de registros de ejemplo para CANCEL_ORDER...\n',
  );

  const records = [];
  const totalRecords = 20;
  const successRatio = 0.75; // 75% éxito, 25% error

  for (let i = 0; i < totalRecords; i++) {
    const orderId = generateOrderId();
    const isSuccess = Math.random() < successRatio;
    const status = isSuccess ? ProcessStatus.SUCCESS : ProcessStatus.ERROR;
    const createdAt = randomDate();

    const metadata = {
      orderId,
      reason: CANCEL_REASONS[Math.floor(Math.random() * CANCEL_REASONS.length)],
      cancelledBy: 'system',
      cancellationDate: createdAt.toISOString(),
      nextOrderId: isSuccess ? `NEXT-${orderId}` : null,
      channel: ['AMZN', 'MERL', 'SPFY', 'YAMZON', 'YMELI'][
        Math.floor(Math.random() * 5)
      ],
    };

    const errorMessage = !isSuccess
      ? ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)]
      : null;

    records.push({
      processType: ProcessLogType.CANCEL_ORDER,
      relatedId: orderId,
      status,
      origin: 'system',
      metadata,
      errorMessage,
      createdAt,
    });
  }

  try {
    // Insertar todos los registros
    const result = await prisma.processLog.createMany({
      data: records,
      skipDuplicates: true,
    });

    console.log(`✅ Se insertaron ${result.count} registros de CANCEL_ORDER`);
    console.log(
      `   - Registros con SUCCESS: ${records.filter((r) => r.status === ProcessStatus.SUCCESS).length}`,
    );
    console.log(
      `   - Registros con ERROR: ${records.filter((r) => r.status === ProcessStatus.ERROR).length}`,
    );
    console.log('\n📊 Resumen de los registros creados:');

    // Mostrar algunos ejemplos
    const examples = await prisma.processLog.findMany({
      where: {
        processType: ProcessLogType.CANCEL_ORDER,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    examples.forEach((log, index) => {
      console.log(`\n   ${index + 1}. Order ID: ${log.relatedId}`);
      console.log(`      Status: ${log.status}`);
      console.log(`      Fecha: ${log.createdAt.toISOString()}`);
      if (log.metadata) {
        const meta = log.metadata as any;
        console.log(`      Razón: ${meta.reason || 'N/A'}`);
        console.log(`      Canal: ${meta.channel || 'N/A'}`);
      }
    });

    console.log('\n✨ Proceso completado exitosamente!');
  } catch (error) {
    console.error('❌ Error al insertar registros:', error);
    throw error;
  }
}

// Ejecutar el script
seedCancelOrderLogs()
  .then(() => {
    console.log('\n🎉 Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
