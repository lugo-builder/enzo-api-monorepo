import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Delete properties that are not in the DTO
      transform: true, // Transforms the input to the specified class
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('CORE API')
    .setDescription('CORE API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5172',
      'http://localhost:5174',
      'https://ecomm-admin.sandbox.promologistics.com.mx',
      'https://ecomm.sandbox.promologistics.com.mx',
      'https://ecomm-admin.promologistics.com.mx',
      'https://ecomm.promologistics.com.mx',
      'https://api.mercadolibre.com',
      'https://rest.axolote.next-cloud.mx',
    ],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });
  await app.listen(3000);
}

bootstrap();
