import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());
  app.enableCors();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const publicApiUrl = config.get<string>('publicApiUrl');
  const swaggerConfigBuilder = new DocumentBuilder()
    .setTitle('Roju Identity API')
    .setDescription(
      'Shared login (OTP, sessions, profile) for every Roju app — "one login, many apps". ' +
        'Click Authorize and paste an accessToken from Verify OTP to try the protected routes.',
    )
    .setVersion('1.0')
    .addBearerAuth();
  swaggerConfigBuilder
    .addTag('Auth', 'OTP login, session refresh/logout, profile — in that order of use')
    .addTag('Health', 'Liveness/readiness check');
  // PUBLIC_API_URL (e.g. a temporary ngrok tunnel, possibly behind a path prefix like
  // /identity if it's sharing one tunnel with roju-ride) is listed first so "Try it out"
  // hits it by default when Swagger UI itself is opened from that same public link.
  if (publicApiUrl) swaggerConfigBuilder.addServer(publicApiUrl, 'Public tunnel');
  swaggerConfigBuilder.addServer(`http://localhost:${config.get<number>('port') ?? 3100}`, 'Local');
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfigBuilder.build());
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = config.get<number>('port') ?? 3100;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`Roju Identity service listening on port ${port}`);
}

bootstrap();
