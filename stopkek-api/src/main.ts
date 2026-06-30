import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { assertProductionSecrets } from './common/bootstrap-check';

async function bootstrap() {
  assertProductionSecrets();

  const app = await NestFactory.create(AppModule);
  const prefix = process.env.API_PREFIX ?? 'api';
  app.setGlobalPrefix(prefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  const origins = process.env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins?.length) {
    app.enableCors({
      origin: origins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  } else if (process.env.NODE_ENV !== 'production') {
    app.enableCors();
  } else {
    app.enableCors({
      origin: false,
    });
  }

  try {
    const helmet = (await import('helmet')).default;
    app.use(helmet());
  } catch {
    /* helmet optional until npm install */
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`stopkek-api http://0.0.0.0:${port}/${prefix}`);
}

bootstrap();
