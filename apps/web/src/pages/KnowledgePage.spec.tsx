/**
 * @test-file   KnowledgePage
 * @description unit tests for StatusBadge labels, document list table rendering, progress bar, retry/delete buttons, and delete mutation
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { KnowledgePage, StatusBadge } from "./KnowledgePage.js";
import { listDocuments, deleteDocument } from "../lib/api.js";
import type { Document } from "../types/api.js";

vi.mock("../lib/api.js", () => ({
  listDocuments: vi.fn(),
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  retryDocument: vi.fn(),
}));

const mockDoc = (overrides: Partial<Document> = {}): Document => ({
  id: "doc-1",
  filename: "test-doc.md",
  fileType: "md",
  status: "done",
  chunkingStrategy: "fixed",
  chunkSize: 500,
  chunkOverlap: 50,
  totalChunks: 10,
  processedChunks: 10,
  createdAt: new Date("2024-01-01").toISOString(),
  ...overrides,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <KnowledgePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * @test-suite  StatusBadge
 * @target      renders the correct label for each document status
 * @strategy    unit, no mocks, renders StatusBadge in isolation
 * @cases
 *   - [PASS] renders "待处理" when status is pending
 *   - [PASS] renders "处理中" when status is processing
 *   - [PASS] renders "完成" when status is done
 *   - [PASS] renders "失败" when status is failed
 */
describe("StatusBadge", () => {
  it('renders "待处理" when status is pending', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText("待处理")).toBeInTheDocument();
  });

  it('renders "处理中" when status is processing', () => {
    render(<StatusBadge status="processing" />);
    expect(screen.getByText("处理中")).toBeInTheDocument();
  });

  it('renders "完成" when status is done', () => {
    render(<StatusBadge status="done" />);
    expect(screen.getByText("完成")).toBeInTheDocument();
  });

  it('renders "失败" when status is failed', () => {
    render(<StatusBadge status="failed" />);
    expect(screen.getByText("失败")).toBeInTheDocument();
  });
});

/**
 * @test-suite  KnowledgePage — empty state
 * @target      placeholder shown when API returns empty document list
 * @strategy    unit, listDocuments mocked to return empty array
 * @cases
 *   - [PASS] shows "暂无文档，请上传" when document list is empty
 */
describe("KnowledgePage — empty state", () => {
  it('shows "暂无文档，请上传" when document list is empty', async () => {
    vi.mocked(listDocuments).mockResolvedValue({ data: [] });
    renderPage();
    await screen.findByText("暂无文档，请上传");
  });
});

/**
 * @test-suite  KnowledgePage — document list
 * @target      table rows and action buttons render correctly based on document state
 * @strategy    unit, listDocuments mocked with fixture data
 * @cases
 *   - [PASS] shows filename when document is returned by API
 *   - [PASS] shows progress bar when document status is processing
 *   - [PASS] shows retry button when document status is failed
 *   - [PASS] removes document from list after delete button is clicked
 */
describe("KnowledgePage — document list", () => {
  it("shows filename when document is returned by API", async () => {
    vi.mocked(listDocuments).mockResolvedValue({ data: [mockDoc()] });
    renderPage();
    expect(await screen.findAllByText("test-doc.md")).not.toHaveLength(0);
  });

  it("shows progress bar when document status is processing", async () => {
    vi.mocked(listDocuments).mockResolvedValue({
      data: [mockDoc({ status: "processing", totalChunks: 20, processedChunks: 5 })],
    });
    renderPage();
    // both desktop and mobile render the chunk count, so use findAllBy
    expect(await screen.findAllByText("5/20 chunks")).not.toHaveLength(0);
    expect(screen.getAllByRole("progressbar")).not.toHaveLength(0);
  });

  it("shows retry button when document status is failed", async () => {
    vi.mocked(listDocuments).mockResolvedValue({ data: [mockDoc({ status: "failed" })] });
    renderPage();
    expect(await screen.findByTitle("重试")).toBeInTheDocument();
  });

  it("removes document from list after delete button is clicked", async () => {
    // First call returns the document; after invalidation refetch returns empty
    vi.mocked(listDocuments)
      .mockResolvedValueOnce({ data: [mockDoc()] })
      .mockResolvedValue({ data: [] });
    vi.mocked(deleteDocument).mockResolvedValue(undefined);
    renderPage();
    const deleteBtn = await screen.findByTitle("删除");
    fireEvent.click(deleteBtn);
    await screen.findByText("暂无文档，请上传");
  });
});
