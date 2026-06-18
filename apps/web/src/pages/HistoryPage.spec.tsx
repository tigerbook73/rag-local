/**
 * @test-file   HistoryPage
 * @description unit tests for conversation list rendering, detail loading, and delete
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HistoryPage } from "./HistoryPage.js";
import type { Conversation, Message } from "../types/index.js";

const mockListConversations = vi.fn();
const mockListMessages = vi.fn();
const mockDeleteConversation = vi.fn();

vi.mock("../lib/api.js", () => ({
  listConversations: (...args: unknown[]) => mockListConversations(...args) as unknown,
  listMessages: (...args: unknown[]) => mockListMessages(...args) as unknown,
  deleteConversation: (...args: unknown[]) => mockDeleteConversation(...args) as unknown,
}));

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage(path = "/history") {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<HistoryPage />} />
          <Route path="/chat/:id" element={<div>ChatPage</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sampleConversations: Conversation[] = [
  {
    id: "conv-1",
    title: "FAQ about pricing",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:05:00.000Z",
  },
  {
    id: "conv-2",
    title: "Setup guide questions",
    createdAt: "2026-06-02T09:00:00.000Z",
    updatedAt: "2026-06-02T09:10:00.000Z",
  },
];

const sampleMessages: Message[] = [
  {
    id: "msg-1",
    conversationId: "conv-1",
    role: "user",
    content: "What is the pricing?",
    createdAt: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "msg-2",
    conversationId: "conv-1",
    role: "assistant",
    content: "The pricing starts at $10/month.",
    createdAt: "2026-06-01T10:00:05.000Z",
  },
];

beforeEach(() => vi.clearAllMocks());

/**
 * @test-suite  HistoryPage — conversation list
 * @target      renders conversation list and empty state
 * @strategy    unit, listConversations mock
 * @cases
 *   - [PASS] renders conversation titles in the list
 *   - [PASS] shows empty state when no conversations exist
 */
describe("HistoryPage — conversation list", () => {
  it("renders conversation titles", async () => {
    mockListConversations.mockResolvedValue({ data: sampleConversations, total: 2 });
    renderPage();
    expect(await screen.findByText("FAQ about pricing")).toBeInTheDocument();
    expect(screen.getByText("Setup guide questions")).toBeInTheDocument();
  });

  it("shows empty state when no conversations", async () => {
    mockListConversations.mockResolvedValue({ data: [], total: 0 });
    renderPage();
    expect(await screen.findByText("暂无对话记录")).toBeInTheDocument();
  });
});

/**
 * @test-suite  HistoryPage — conversation detail
 * @target      loads and renders messages for selected conversation
 * @strategy    unit, listMessages mock, routed to /history/:id
 * @cases
 *   - [PASS] renders messages for the selected conversation
 *   - [PASS] "继续对话" button navigates to /chat/:id
 */
describe("HistoryPage — conversation detail", () => {
  it("renders messages for the selected conversation", async () => {
    mockListConversations.mockResolvedValue({ data: sampleConversations, total: 2 });
    mockListMessages.mockResolvedValue({ data: sampleMessages });
    renderPage("/history/conv-1");
    expect(await screen.findByText("What is the pricing?")).toBeInTheDocument();
    expect(screen.getByText("The pricing starts at $10/month.")).toBeInTheDocument();
  });

  it("navigates to /chat/:id when 继续对话 is clicked", async () => {
    mockListConversations.mockResolvedValue({ data: sampleConversations, total: 2 });
    mockListMessages.mockResolvedValue({ data: sampleMessages });
    renderPage("/history/conv-1");
    await screen.findByText("继续对话");
    await userEvent.click(screen.getByText("继续对话"));
    await waitFor(() => {
      expect(screen.getByText("ChatPage")).toBeInTheDocument();
    });
  });
});

/**
 * @test-suite  HistoryPage — delete conversation
 * @target      calls deleteConversation and refreshes list
 * @strategy    unit, deleteConversation mock
 * @cases
 *   - [PASS] calls deleteConversation with correct id when delete button clicked
 */
describe("HistoryPage — delete conversation", () => {
  it("calls deleteConversation when delete button is clicked", async () => {
    mockListConversations.mockResolvedValue({ data: sampleConversations, total: 2 });
    mockDeleteConversation.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText("FAQ about pricing");

    // hover to reveal delete button (opacity-0 group-hover via CSS, but button is in DOM)
    const deleteButtons = screen.getAllByLabelText("删除对话");
    await userEvent.click(deleteButtons[0]!);

    await waitFor(() => {
      expect(mockDeleteConversation).toHaveBeenCalledWith("conv-1");
    });
  });
});
