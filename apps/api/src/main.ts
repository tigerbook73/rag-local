import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { validateEnv } from "./common/env";

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
  });

  const swaggerConfig = new DocumentBuilder().setTitle("RAG Local API").setVersion("1.0").build();
  SwaggerModule.setup("api", app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env["PORT"] ?? 3001);
  await app.listen(port);
}

void bootstrap();
