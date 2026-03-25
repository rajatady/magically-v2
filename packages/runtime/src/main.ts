import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

const PORT = parseInt(process.env.PORT ?? '4321', 10);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Allow the web app (Vite dev server) to talk to the runtime
  app.enableCors({
    origin: [
      'http://localhost:5173',  // Vite default
      'http://localhost:3000',
      'app://.',                // macOS WebView / Tauri
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(PORT);
  Logger.log(`Magically runtime running on http://localhost:${PORT}`, 'Bootstrap');
}

bootstrap();
