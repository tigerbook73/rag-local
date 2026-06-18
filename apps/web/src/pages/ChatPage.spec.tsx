/**
 * @test-file   ChatPage
 * @description unit tests for SourcesSection expand/collapse behavior and error alert rendering
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ChatPage } from "./ChatPage.js";
import { useConversationStore } from "../stores/conversation.store.js";
import type { Message } from "../types/index.js";

vi.mock("../lib/api.js", () => ({
  createConversation: vi.fn(),
  streamChat: vi.fn(),
  updateConversation: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ChatPage />
    </MemoryRouter>,
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
      content: "Answer content here",
      similarityScore: 0.92,
    },
  ],
};

beforeEach(() => {
  useConversationStore.getState().resetConversation();
  vi.clearAllMocks();
});

/**
 * @test-suite  SourcesSection
 * @target      expand/collapse behavior of the retrieved chunks collapsible
 * @strategy    unit, conversation store seeded with assistant message containing retrieved chunks
 * @cases
 *   - [PASS] hides chunk content by default when assistant message has retrieved chunks
 *   - [PASS] shows chunk content when trigger button is clicked
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

/**
 * @test-suite  ChatPage — empty state
 * @target      input placeholder visible when no conversation messages exist
 * @strategy    unit, conversation store in initial state
 * @cases
 *   - [PASS] shows input placeholder when no messages exist
 */
describe("ChatPage — empty state", () => {
  it("shows input placeholder when no messages exist", () => {
    renderPage();
    expect(screen.getByPlaceholderText(/输入问题/)).toBeInTheDocument();
  });
});
