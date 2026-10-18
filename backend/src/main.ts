import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { describeDbTarget } from './config/db-target';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Make "which database am I on?" visible in the first lines of output (host + db name only, never credentials).
  const db = describeDbTarget(process.env);
  const log = new Logger('Database');
  log.log(`${db.host}/${db.database} (APP_ENV=${db.appEnv ?? 'unset'})`);
  db.warnings.forEach((w) => log.warn(w));
  // `Content-Disposition` isn't in the CORS-safelisted response headers by default — the
  // frontend needs it exposed to read the generated sprint-summary file name off the response.
  app.enableCors({ exposedHeaders: ['Content-Disposition'] });
  await app.listen(process.env.BACKEND_PORT ?? 5005, '0.0.0.0');
}
bootstrap();
