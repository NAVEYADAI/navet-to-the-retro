import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // `Content-Disposition` isn't in the CORS-safelisted response headers by default — the
  // frontend needs it exposed to read the generated sprint-summary file name off the response.
  app.enableCors({ exposedHeaders: ['Content-Disposition'] });
  await app.listen(process.env.BACKEND_PORT ?? 5005, '0.0.0.0');
}
bootstrap();
