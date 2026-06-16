import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Health check" })
  check(): { status: string } {
    return { status: "ok" };
  }

  @Get("queue")
  @ApiOperation({ summary: "Queue connectivity health check" })
  async checkQueue(): Promise<{ status: string }> {
    try {
      return await this.health.checkQueue();
    } catch {
      throw new ServiceUnavailableException("Queue unreachable");
    }
  }

  @Get("db")
  @ApiOperation({ summary: "Database connectivity health check" })
  async checkDb(): Promise<{ status: string }> {
    try {
      return await this.health.checkDb();
    } catch {
      throw new ServiceUnavailableException("Database unreachable");
    }
  }
}
