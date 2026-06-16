import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { HealthController } from "./modules/health/health.controller";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env["NODE_ENV"] !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
      },
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
