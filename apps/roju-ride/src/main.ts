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
    .setTitle('Roju Ride API')
    .setDescription(
      'Catalog, pricing, rides, drivers, location and batch-matching for Roju Ride (Auto/Bike/Cab/Scooty). ' +
        'Most routes need a rider or driver access token from roju-identity — click Authorize and paste it.',
    )
    .setVersion('1.0')
    .addBearerAuth();
  // Declared explicitly, in the order a booking actually happens, so Swagger UI's group
  // order follows the flow instead of whatever order Nest happened to register controllers
  // in: check what's available -> get a fare -> a driver goes online and starts sending
  // location -> a rider books -> a driver gets matched -> the driver runs the trip.
  swaggerConfigBuilder
    .addTag('Catalog', 'What services/ride categories are available in a city')
    .addTag('Pricing', 'Fare estimate for a prospective ride')
    .addTag('Drivers', "A driver's own ONLINE/OFFLINE availability")
    .addTag('Location', "A driver's live GPS pings (matching + trip tracking read this)")
    .addTag('Rides (Rider)', 'Booking and managing a ride, from the rider side')
    .addTag('Matching', 'A driver accepting or declining an offered ride')
    .addTag('Rides (Driver)', 'Running an accepted ride, from the driver side')
    .addTag('Health', 'Liveness/readiness check');
  // PUBLIC_API_URL (e.g. a temporary ngrok tunnel) is listed first so "Try it out" hits it
  // by default — useful when Swagger UI itself is being opened from that same public link.
  if (publicApiUrl) swaggerConfigBuilder.addServer(publicApiUrl, 'Public tunnel');
  swaggerConfigBuilder.addServer(`http://localhost:${config.get<number>('port') ?? 3000}`, 'Local');
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfigBuilder.build());
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`Roju Ride backend listening on port ${port}`);
}

bootstrap();
