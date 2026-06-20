export interface ChunkResult {
  content: string;
  index: number;
  startOffset: number;
  metadata?: Record<string, unknown>;
}

export interface ChunkingStrategy {
  chunk(text: string): ChunkResult[];
}

export class FixedSizeChunkingStrategy implements ChunkingStrategy {
  constructor(
    private readonly chunkSize: number,
    private readonly overlap: number,
  ) {}

  chunk(text: string): ChunkResult[] {
    if (text.length === 0) return [];

    const results: ChunkResult[] = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      results.push({ content: text.slice(start, end), index, startOffset: start });
      if (end >= text.length) break;
      start += this.chunkSize - this.overlap;
      index++;
    }

    return results;
  }
}

/** D-04: Semantic chunking algorithm TBD — falls back to fixed for now */
export class SemanticChunkingStrategy implements ChunkingStrategy {
  private readonly fallback: FixedSizeChunkingStrategy;

  constructor(chunkSize: number, overlap: number) {
    this.fallback = new FixedSizeChunkingStrategy(chunkSize, overlap);
  }

  chunk(text: string): ChunkResult[] {
    return this.fallback.chunk(text);
  }
}

export function createChunkingStrategy(settings: {
  strategy: "fixed" | "semantic";
  chunkSize: number;
  chunkOverlap: number;
}): ChunkingStrategy {
  if (settings.strategy === "semantic") {
    return new SemanticChunkingStrategy(settings.chunkSize, settings.chunkOverlap);
  }
  return new FixedSizeChunkingStrategy(settings.chunkSize, settings.chunkOverlap);
}

/** Strip Markdown syntax for clean embedding text. Chunk content in DB retains original markdown. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "") // fenced code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/__([^_]+)__/g, "$1") // bold alt
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/_([^_]+)_/g, "$1") // italic alt
    .replace(/~~([^~]+)~~/g, "$1") // strikethrough
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links
    .replace(/^\s*[-*+]\s+/gm, "") // unordered lists
    .replace(/^\s*\d+\.\s+/gm, "") // ordered lists
    .replace(/^\s*>\s*/gm, "") // blockquotes
    .replace(/^[-*_]{3,}\s*$/gm, "") // horizontal rules
    .replace(/\|[^\n]+\|/g, "") // table rows
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
