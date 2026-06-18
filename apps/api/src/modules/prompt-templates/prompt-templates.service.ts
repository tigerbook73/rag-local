import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service.js";
import type { CreatePromptTemplateDto } from "./dto/create-prompt-template.dto.js";
import type { UpdatePromptTemplateDto } from "./dto/update-prompt-template.dto.js";

@Injectable()
export class PromptTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const data = await this.prisma.promptTemplate.findMany({
      orderBy: { createdAt: "asc" },
    });
    return { data };
  }

  async create(dto: CreatePromptTemplateDto) {
    return this.prisma.promptTemplate.create({
      data: { name: dto.name, content: dto.content },
    });
  }

  async update(id: string, dto: UpdatePromptTemplateDto) {
    const template = await this.prisma.promptTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException("Prompt template not found");

    if (dto.isActive === true) {
      // Deactivate all others in same transaction, then activate this one
      const [, updated] = await this.prisma.$transaction([
        this.prisma.promptTemplate.updateMany({
          where: { id: { not: id } },
          data: { isActive: false },
        }),
        this.prisma.promptTemplate.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.content !== undefined && { content: dto.content }),
            isActive: true,
          },
        }),
      ]);
      return updated;
    } else {
      return this.prisma.promptTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.content !== undefined && { content: dto.content }),
          ...(dto.isActive === false && { isActive: false }),
        },
      });
    }
  }

  async remove(id: string) {
    const template = await this.prisma.promptTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException("Prompt template not found");
    if (template.isActive) throw new BadRequestException("Cannot delete an active prompt template");
    await this.prisma.promptTemplate.delete({ where: { id } });
  }
}
