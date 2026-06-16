# Dev-Task State: phase-1-basic-rag

## Metadata

- type: feature
- status: in_progress

## Document Index

- (no documents yet)

## Current Phase

implementation (in_progress)

## Current Step

Step 5: apps/web

## Requirements Phase

- status: done
- notes:
  - Requirements derived from docs/08-phases.md Phase 1 section
  - Acceptance: upload TXT/MD → status done → ask question → streaming answer → source citations

## Design Phase

- status: done
- notes:
  - DB schema: docs/03-database.md
  - API: docs/04-api.md
  - Modules: docs/05-modules.md
  - UI: docs/06-ui.md
  - Key decisions: remove-markdown for strip, React Query for web, config.toml for Supabase bucket, main.ts --spec for OpenAPI

## Implementation Phase

- status: in_progress

### Step 1: DB Schema (packages/db)

- step-type: intermediate
- status: done
- Commit: —
- Date: 2026-06-17
- auto-check: —
- manual-check: —

### Step 2: packages/core (Chunking + Embedding + LLM + Retrieval)

- step-type: intermediate
- status: done
- Commit: —
- Date: 2026-06-17
- auto-check: —
- manual-check: —

### Step 3: apps/api (Documents + Conversations + Messages + Settings modules)

- step-type: intermediate
- status: done
- Commit: —
- Date: 2026-06-17
- auto-check: —
- manual-check: —

### Step 4: apps/worker (EmbeddingProcessor)

- step-type: intermediate
- status: done
- Commit: —
- Date: 2026-06-17
- auto-check: —
- manual-check: —

### Step 5: apps/web (Knowledge page + Chat page)

- step-type: final
- status: done
- Commit: —
- Date: 2026-06-17
- auto-check: —
- manual-check: —

## Dev-Task Acceptance

- auto-check: —
- manual-check: —
