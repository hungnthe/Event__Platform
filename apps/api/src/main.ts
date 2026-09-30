import { ValidationPipe } from '@nestjs/common'; import { ConfigService } from '@nestjs/config'; import { NestFactory } from '@nestjs/core'; import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; import { json, urlencoded } from 'express'; import helmet from 'helmet'; import { Logger } from 'nestjs-pino'; import { AppModule } from './app.module'; import { HttpExceptionFilter } from './common/http-exception.filter'; import { requestIdMiddleware } from './common/request-id.middleware'; import { ConfiguredIoAdapter } from './infrastructure/configured-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: true });
  const config = app.get(ConfigService); app.useLogger(app.get(Logger)); app.useWebSocketAdapter(new ConfiguredIoAdapter(app, config)); app.use(helmet()); app.use(json({ limit: '100kb' })); app.use(urlencoded({ extended: false, limit: '100kb' })); app.use(requestIdMiddleware); app.enableShutdownHooks();
  app.enableCors({ origin: config.getOrThrow<string>('CORS_ORIGINS').split(',').map((origin) => origin.trim()), credentials: true, methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })); app.useGlobalFilters(new HttpExceptionFilter()); app.setGlobalPrefix('api/v1');
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('EventFlow API').setVersion('1.0').build()); SwaggerModule.setup('docs', app, document);
  await app.listen(config.getOrThrow<number>('API_PORT'));
}
void bootstrap();
