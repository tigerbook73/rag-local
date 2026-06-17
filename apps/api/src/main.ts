import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";
import { validateEnv } from "./common/env.js";
import { API_PREFIX } from "./common/constants.js";

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
  });

  const swaggerConfig = new DocumentBuilder().setTitle("RAG Local API").setVersion("1.0").build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api", app, document);

  const port = Number(process.env["PORT"] ?? 3001);
  await app.listen(port);
}

void bootstrap();
