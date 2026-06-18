import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PrismaService } from "../../common/prisma.service.js";
import { SUPABASE_CLIENT } from "../../common/supabase.module.js";
import { QUEUE_NAMES, type EmbeddingJobData } from "@rag-local/core";
import { SettingsService } from "../settings/settings.service.js";

const ALLOWED_EXTENSIONS = ["txt", "md"] as const;
type AllowedExt = (typeof ALLOWED_EXTENSIONS)[number];
const MAX_SIZE_BYTES = Number(process.env["MAX_FILE_SIZE_MB"] ?? 10) * 1024 * 1024;
const STORAGE_BUCKET = process.env["STORAGE_BUCKET"] ?? "documents";

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @InjectQueue(QUEUE_NAMES.EMBEDDING) private readonly embeddingQueue: Queue,
  ) {}

  async upload(file: Express.Multer.File) {
    // busboy decodes the Content-Disposition filename as Latin-1; re-encode to recover UTF-8
    const originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
    const ext = originalname.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext as AllowedExt)) {
      throw new BadRequestException("Only .txt and .md files are supported");
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `File size exceeds ${process.env["MAX_FILE_SIZE_MB"] ?? 10}MB limit`,
      );
    }

    const fileType = ext as AllowedExt;
    const storagePath = `${Date.now()}-${originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error: uploadError } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file.buffer, { contentType: file.mimetype });

    if (uploadError) {
      throw new BadRequestException(`Storage upload failed: ${uploadError.message}`);
    }

    const settings = await this.settingsService.getSettings();

    const doc = await this.prisma.document.create({
      data: {
        filename: originalname,
        fileType,
        storagePath,
        status: "pending",
        chunkingStrategy: settings.chunkingStrategy,
        chunkSize: settings.chunkSize,
        chunkOverlap: settings.chunkOverlap,
      },
    });

    const jobData: EmbeddingJobData = {
      documentId: doc.id,
      storagePath,
      fileType,
      chunkingStrategy: doc.chunkingStrategy,
      chunkSize: doc.chunkSize,
      chunkOverlap: doc.chunkOverlap,
    };

    await this.embeddingQueue.add("embed", jobData, {
      attempts: Number(process.env["JOB_RETRY_COUNT"] ?? 3),
      backoff: { type: "exponential", delay: 5000 },
    });

    return { id: doc.id, filename: doc.filename, status: doc.status };
  }

  async findAll() {
    const data = await this.prisma.document.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { data };
  }

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Document not found");
    return doc;
  }

  async remove(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Document not found");

    const { error } = await this.supabase.storage.from(STORAGE_BUCKET).remove([doc.storagePath]);
    if (error) {
      this.logger.warn(`Storage deletion failed for ${doc.storagePath}: ${error.message}`);
    }
    await this.prisma.document.delete({ where: { id } });
  }

  async retry(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Document not found");
    if (doc.status !== "failed") {
      throw new BadRequestException("Only failed documents can be retried");
    }

    await this.prisma.document.update({
      where: { id },
      data: { status: "pending", errorMessage: null, processedChunks: null },
    });

    const jobData: EmbeddingJobData = {
      documentId: doc.id,
      storagePath: doc.storagePath,
      fileType: doc.fileType,
      chunkingStrategy: doc.chunkingStrategy,
      chunkSize: doc.chunkSize,
      chunkOverlap: doc.chunkOverlap,
    };

    await this.embeddingQueue.add("embed", jobData, {
      attempts: Number(process.env["JOB_RETRY_COUNT"] ?? 3),
      backoff: { type: "exponential", delay: 5000 },
    });

    return { status: "pending" };
  }
}
