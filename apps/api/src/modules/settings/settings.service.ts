import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service.js";
import type { UpdateSettingsDto } from "./dto/update-settings.dto.js";

const STATIC_FIELDS = ["chunkingStrategy", "chunkSize", "chunkOverlap"] as const;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    // Settings row is always present (seeded); upsert if missing
    if (!settings) {
      return this.prisma.settings.upsert({
        where: { id: 1 },
        create: {},
        update: {},
      });
    }
    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto) {
    const before = await this.getSettings();
    const updated = await this.prisma.settings.update({ where: { id: 1 }, data: dto });

    const requiresReindex = STATIC_FIELDS.some(
      (f) => dto[f] !== undefined && dto[f] !== (before as Record<string, unknown>)[f],
    );

    return requiresReindex ? { ...updated, requiresReindex: true } : updated;
  }
}
