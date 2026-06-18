/**
 * @test-file   DocumentsService
 * @description unit tests for upload(), findOne(), remove(), and retry() including processedChunks reset on retry
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { DocumentsService } from "./documents.service.js";
import { PrismaService } from "../../common/prisma.service.js";
import { SUPABASE_CLIENT } from "../../common/supabase.module.js";
import { SettingsService } from "../settings/settings.service.js";
import { QUEUE_NAMES } from "@rag-local/core";

const mockPrisma = {
  document: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

const mockSupabaseStorage = {
  upload: vi.fn(),
  remove: vi.fn(),
};

const mockSupabase = {
  storage: {
    from: vi.fn().mockReturnValue(mockSupabaseStorage),
  },
};

const mockSettingsService = {
  getSettings: vi.fn(),
};

const mockQueue = {
  add: vi.fn(),
};

const DEFAULT_SETTINGS = {
  chunkingStrategy: "fixed",
  chunkSize: 512,
  chunkOverlap: 50,
};

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    originalname: "test.md",
    mimetype: "text/markdown",
    size: 1024,
    buffer: Buffer.from("# Hello"),
    fieldname: "file",
    encoding: "7bit",
    stream: null as unknown as Express.Multer.File["stream"],
    destination: "",
    filename: "",
    path: "",
    ...overrides,
  };
}

async function buildService() {
  const module = await Test.createTestingModule({
    providers: [
      DocumentsService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      { provide: SettingsService, useValue: mockSettingsService },
      { provide: getQueueToken(QUEUE_NAMES.EMBEDDING), useValue: mockQueue },
    ],
  }).compile();
  return module.get(DocumentsService);
}

/**
 * @test-suite  DocumentsService — upload()
 * @target      file validation, Supabase storage upload, document creation, and job enqueue
 * @strategy    unit, PrismaService / SupabaseClient / SettingsService / BullMQ Queue mocked
 * @cases
 *   - [FAIL] throws BadRequestException when file extension is not .txt or .md
 *   - [FAIL] throws BadRequestException when file size exceeds the limit
 *   - [FAIL] throws BadRequestException when Supabase storage upload fails
 *   - [PASS] creates document record and enqueues job when upload succeeds
 */
describe("DocumentsService — upload()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsService.getSettings.mockResolvedValue(DEFAULT_SETTINGS);
    mockSupabaseStorage.upload.mockResolvedValue({ error: null });
    mockPrisma.document.create.mockResolvedValue({
      id: "doc-1",
      filename: "test.md",
      status: "pending",
      chunkingStrategy: "fixed",
      chunkSize: 512,
      chunkOverlap: 50,
      storagePath: "12345-test.md",
      fileType: "md",
    });
    mockQueue.add.mockResolvedValue({});
  });

  it("throws BadRequestException when file extension is not .txt or .md", async () => {
    const service = await buildService();
    const file = makeFile({ originalname: "report.pdf" });
    await expect(service.upload(file)).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when file size exceeds the limit", async () => {
    const service = await buildService();
    // Default MAX_FILE_SIZE_MB is 10 → 10 * 1024 * 1024 bytes
    const file = makeFile({ size: 11 * 1024 * 1024 });
    await expect(service.upload(file)).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when Supabase storage upload fails", async () => {
    mockSupabaseStorage.upload.mockResolvedValue({ error: { message: "bucket not found" } });
    const service = await buildService();
    await expect(service.upload(makeFile())).rejects.toThrow(BadRequestException);
  });

  it("creates document record and enqueues job when upload succeeds", async () => {
    const service = await buildService();
    const result = await service.upload(makeFile());

    expect(mockPrisma.document.create).toHaveBeenCalledOnce();
    expect(mockQueue.add).toHaveBeenCalledWith(
      "embed",
      expect.objectContaining({ documentId: "doc-1" }),
      expect.any(Object),
    );
    expect(result).toEqual({ id: "doc-1", filename: "test.md", status: "pending" });
  });
});

/**
 * @test-suite  DocumentsService — findOne()
 * @target      document lookup by id
 * @strategy    unit, PrismaService mocked
 * @cases
 *   - [FAIL] throws NotFoundException when document does not exist
 *   - [PASS] returns document when found
 */
describe("DocumentsService — findOne()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws NotFoundException when document does not exist", async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null);
    const service = await buildService();
    await expect(service.findOne("missing-id")).rejects.toThrow(NotFoundException);
  });

  it("returns document when found", async () => {
    const doc = { id: "doc-1", filename: "faq.md", status: "done" };
    mockPrisma.document.findUnique.mockResolvedValue(doc);
    const service = await buildService();
    await expect(service.findOne("doc-1")).resolves.toEqual(doc);
  });
});

/**
 * @test-suite  DocumentsService — remove()
 * @target      document deletion from storage and DB
 * @strategy    unit, PrismaService / SupabaseClient mocked
 * @cases
 *   - [FAIL] throws NotFoundException when document does not exist
 *   - [PASS] removes file from storage and deletes document record when found
 *   - [PASS] deletes document record even when storage deletion fails
 */
describe("DocumentsService — remove()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws NotFoundException when document does not exist", async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null);
    const service = await buildService();
    await expect(service.remove("missing-id")).rejects.toThrow(NotFoundException);
  });

  it("removes file from storage and deletes document record when found", async () => {
    const doc = { id: "doc-1", storagePath: "12345-faq.md" };
    mockPrisma.document.findUnique.mockResolvedValue(doc);
    mockSupabaseStorage.remove.mockResolvedValue({ error: null });
    mockPrisma.document.delete.mockResolvedValue(doc);

    const service = await buildService();
    await service.remove("doc-1");

    expect(mockSupabaseStorage.remove).toHaveBeenCalledWith(["12345-faq.md"]);
    expect(mockPrisma.document.delete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
  });

  it("deletes document record even when storage deletion fails", async () => {
    const doc = { id: "doc-1", storagePath: "12345-faq.md" };
    mockPrisma.document.findUnique.mockResolvedValue(doc);
    mockSupabaseStorage.remove.mockResolvedValue({ error: { message: "Object not found" } });
    mockPrisma.document.delete.mockResolvedValue(doc);

    const service = await buildService();
    await service.remove("doc-1");

    expect(mockPrisma.document.delete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
  });
});

/**
 * @test-suite  DocumentsService — retry()
 * @target      re-enqueue embedding job for failed documents
 * @strategy    unit, PrismaService / BullMQ Queue mocked
 * @cases
 *   - [FAIL] throws NotFoundException when document does not exist
 *   - [FAIL] throws BadRequestException when document status is not "failed"
 *   - [PASS] resets status to pending and enqueues job when document has failed status
 *   - [PASS] resets processedChunks to null when retrying a failed document
 */
describe("DocumentsService — retry()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws NotFoundException when document does not exist", async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null);
    const service = await buildService();
    await expect(service.retry("missing-id")).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when document status is not "failed"', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({ id: "doc-1", status: "done" });
    const service = await buildService();
    await expect(service.retry("doc-1")).rejects.toThrow(BadRequestException);
  });

  it("resets status to pending and enqueues job when document has failed status", async () => {
    const doc = {
      id: "doc-1",
      status: "failed",
      storagePath: "12345-faq.md",
      fileType: "md",
      chunkingStrategy: "fixed",
      chunkSize: 512,
      chunkOverlap: 50,
    };
    mockPrisma.document.findUnique.mockResolvedValue(doc);
    mockPrisma.document.update.mockResolvedValue({ ...doc, status: "pending" });
    mockQueue.add.mockResolvedValue({});

    const service = await buildService();
    const result = await service.retry("doc-1");

    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "pending", errorMessage: null, processedChunks: null },
      }),
    );
    expect(mockQueue.add).toHaveBeenCalledWith(
      "embed",
      expect.objectContaining({ documentId: "doc-1" }),
      expect.any(Object),
    );
    expect(result).toEqual({ status: "pending" });
  });

  it("resets processedChunks to null when retrying a failed document", async () => {
    const doc = {
      id: "doc-2",
      status: "failed",
      storagePath: "path.md",
      fileType: "md",
      chunkingStrategy: "fixed",
      chunkSize: 512,
      chunkOverlap: 50,
      processedChunks: 32,
      totalChunks: 100,
    };
    mockPrisma.document.findUnique.mockResolvedValue(doc);
    mockPrisma.document.update.mockResolvedValue({
      ...doc,
      status: "pending",
      processedChunks: null,
    });
    mockQueue.add.mockResolvedValue({});

    const service = await buildService();
    await service.retry("doc-2");

    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processedChunks: null }),
      }),
    );
  });
});
