import "reflect-metadata";
import fs from "node:fs";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";
import { validateEnv } from "./common/env.js";

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
  });

  const swaggerConfig = new DocumentBuilder().setTitle("RAG Local API").setVersion("1.0").build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api", app, document);

  // --spec <path>: write OpenAPI spec to file and exit (no HTTP server started)
  const specFlagIdx = process.argv.indexOf("--spec");
  if (specFlagIdx !== -1) {
    const outPath = process.argv[specFlagIdx + 1] ?? "openapi.json";
    fs.writeFileSync(outPath, JSON.stringify(document, null, 2));
    await app.close();
    return;
  }

  const port = Number(process.env["PORT"] ?? 3001);
  await app.listen(port);
}

void bootstrap();
