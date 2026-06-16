import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service.js";
import type { UpdateConversationDto } from "./dto/update-conversation.dto.js";

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create() {
    const conv = await this.prisma.conversation.create({ data: {} });
    return { id: conv.id, title: conv.title, createdAt: conv.createdAt.toISOString() };
  }

  async findAll() {
    const data = await this.prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
    });
    const total = await this.prisma.conversation.count();
    return { data, total };
  }

  async update(id: string, dto: UpdateConversationDto) {
    await this.assertExists(id);
    const conv = await this.prisma.conversation.update({
      where: { id },
      data: { title: dto.title },
    });
    return { id: conv.id, title: conv.title };
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.conversation.delete({ where: { id } });
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.conversation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Conversation not found");
  }
}
