import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Verificar si ya existe el tipo de notificación
  const existing = await prisma.notificationType.findUnique({
    where: { code: 'failed-cancellation-notification' },
  });

  if (existing) {
    console.log('El tipo de notificación "failed-cancellation-notification" ya existe');
    return;
  }

  // Crear el tipo de notificación
  const cancellationFailedNotificationType = await prisma.notificationType.create({
    data: {
      code: 'failed-cancellation-notification',
      name: 'Cancelación Fallida',
      description: 'Se envía cuando una cancelación de orden falla en el sistema',
      category: 'ORDERS',
      isActive: true,
      createdBy: 'seed',
      createdAt: new Date(),
    },
  });

  console.log('Tipo de notificación creado:', cancellationFailedNotificationType);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });