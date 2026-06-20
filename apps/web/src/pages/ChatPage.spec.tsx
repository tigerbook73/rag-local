/**
 * @test-file   ChatPage
 * @description unit tests for empty state, loading existing conversation, and error display
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatPage } from "./ChatPage.js";
import { useConversationStore } from "../stores/conversation.store.js";
import type { Message } from "../types/index.js";

const mockListMessages = vi.fn();

vi.mock("../lib/api.js", () => ({
  createConversation: vi.fn(),
  streamChat: vi.fn(),
  updateConversation: vi.fn(),
  listMessages: (...args: unknown[]) => mockListMessages(...args) as unknown,
  getSettings: vi.fn().mockResolvedValue({ onlineEvaluationEnabled: false }),
}));

function renderPage(path = "/chat") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:id" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const assistantMessageWithChunks: Message = {
  id: "msg-1",
  conversationId: "conv-1",
  role: "assistant",
  content: "Based on the docs...",
  createdAt: new Date().toISOString(),
  retrievedChunks: [
    {
      chunkId: "chunk-1",
      documentId: "doc-1",
      documentName: "faq.md",
      fileType: "md" as const,
      content: "Answer content here",
      similarityScore: 0.92,
      metadata: null,
    },
  ],
};

beforeEach(() => {
  useConversationStore.getState().resetConversation();
  vi.clearAllMocks();
});

/**
 * @test-suite  ChatPage — empty state
 * @target      input placeholder visible when no conversation messages exist
 * @strategy    unit, store in initial state
 * @cases
 *   - [PASS] shows input placeholder when no messages exist
 */
describe("ChatPage — empty state", () => {
  it("shows input placeholder when no messages exist", () => {
    renderPage();
    expect(screen.getByPlaceholderText(/输入问题/)).toBeInTheDocument();
  });
});

/**
 * @test-suite  ChatPage — load existing conversation
 * @target      fetches messages from API when navigating to /chat/:id
 * @strategy    unit, listMessages mock
 * @cases
 *   - [PASS] loads messages from API when id param is present
 *   - [PASS] shows error when listMessages fails
 */
describe("ChatPage — load existing conversation", () => {
  it("loads messages from API when id param is present", async () => {
    mockListMessages.mockResolvedValue({ data: [assistantMessageWithChunks] });
    renderPage("/chat/conv-1");
    await waitFor(() => {
      expect(mockListMessages).toHaveBeenCalledWith("conv-1");
    });
    expect(await screen.findByText("Based on the docs...")).toBeInTheDocument();
  });

  it("shows error alert when listMessages fails", async () => {
    mockListMessages.mockRejectedValue(new Error("network error"));
    renderPage("/chat/conv-1");
    expect(await screen.findByText("加载消息失败")).toBeInTheDocument();
  });
});

/**
 * @test-suite  SourcesSection
 * @target      expand/collapse behavior of the retrieved chunks collapsible
 * @strategy    unit, store seeded with assistant message containing retrieved chunks
 * @cases
 *   - [PASS] hides chunk content by default
 *   - [PASS] shows chunk content after clicking the trigger
 */
describe("SourcesSection", () => {
  it("hides chunk content by default when assistant message has retrieved chunks", () => {
    useConversationStore.setState({ messages: [assistantMessageWithChunks] });
    renderPage();
    expect(screen.queryByText("Answer content here")).not.toBeInTheDocument();
  });

  it("shows chunk content when trigger button is clicked", async () => {
    useConversationStore.setState({ messages: [assistantMessageWithChunks] });
    renderPage();
    await userEvent.click(screen.getByText(/引用来源/));
    expect(await screen.findByText("Answer content here")).toBeInTheDocument();
  });
});
