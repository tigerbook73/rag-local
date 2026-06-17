import "reflect-metadata";

// Supabase SDK validates the URL format in createClient() at module init time.
// Set placeholder values so DI can instantiate providers without real infrastructure.
process.env["DATABASE_URL"] ??= "postgresql://localhost/placeholder";
process.env["REDIS_URL"] ??= "redis://localhost";
process.env["SUPABASE_URL"] ??= "https://placeholder.supabase.co";
process.env["SUPABASE_SERVICE_KEY"] ??= "placeholder";
process.env["OPENAI_API_KEY"] ??= "placeholder";
process.env["DEEPSEEK_API_KEY"] ??= "placeholder";

import fs from "node:fs";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { API_PREFIX } from "./common/constants.js";

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.setGlobalPrefix(API_PREFIX);

  const config = new DocumentBuilder().setTitle("RAG Local API").setVersion("1.0").build();
  const document = SwaggerModule.createDocument(app, config);

  const outPath = process.argv[2] ?? "openapi.json";
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2));

  process.exit(0);
}

void generate();
