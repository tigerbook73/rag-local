# Dev-Task State: phase-2-conversation-management

## Metadata

- type: feature
- status: in_progress

## Document Index

- (no documents yet; entries added here as requirements and design documents are created)

## Current Phase

implementation (done)

## Current Step

Step 3: Frontend — HistoryPage (done)

## Requirements Phase

- status: done
- notes:
  - Requirements from docs/08-phases.md Phase 2
  - D-03 resolved: conversationHistoryWindow unit = 轮 (1 round = 1 user + 1 assistant message)
  - Acceptance: multi-turn context coherent → History page shows conversation list + detail

## Design Phase

- status: done
- notes:
  - Backend: inject last (window×2) messages into LLM prompt before current user turn
  - Frontend: ChatPage loads existing messages on mount; Chat-specific left sidebar for conversation switching
  - HistoryPage: extract shared MessageList component; /history list + /history/:id read-only detail
  - Conversation title auto-fill stays client-side (no backend change)
  - Use React Query for conversation list (consistent with KnowledgePage pattern)

## Implementation Phase

- status: in_progress

## Dev-Task Acceptance

- auto-check: —
- manual-check: —
