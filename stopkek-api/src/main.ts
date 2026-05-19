import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prefix = process.env.API_PREFIX ?? 'api';
  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  );
  app.enableCors();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`stopkek-api http://localhost:${port}/${prefix}`);
}

bootstrap();
