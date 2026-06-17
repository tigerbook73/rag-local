/**
 * @test-file   ChunkingStrategy
 * @description unit tests for FixedSizeChunkingStrategy, SemanticChunkingStrategy, createChunkingStrategy, and stripMarkdown
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { describe, it, expect } from "vitest";
import {
  FixedSizeChunkingStrategy,
  SemanticChunkingStrategy,
  createChunkingStrategy,
  stripMarkdown,
} from "./strategy.js";

/**
 * @test-suite  FixedSizeChunkingStrategy — chunk()
 * @target      sliding-window character chunking with overlap
 * @strategy    unit, no dependencies
 * @cases
 *   - [PASS] returns [] when text is empty
 *   - [PASS] returns single chunk when text fits within chunkSize
 *   - [PASS] returns single chunk when text length equals chunkSize
 *   - [PASS] returns multiple chunks with correct overlap
 *   - [PASS] last chunk ends at text boundary, not at chunkSize
 *   - [PASS] chunk indices start at 0 and increment by 1
 */
describe("FixedSizeChunkingStrategy — chunk()", () => {
  it("returns [] when text is empty", () => {
    const strategy = new FixedSizeChunkingStrategy(100, 10);
    expect(strategy.chunk("")).toEqual([]);
  });

  it("returns single chunk when text fits within chunkSize", () => {
    const strategy = new FixedSizeChunkingStrategy(100, 10);
    const result = strategy.chunk("hello");
    expect(result).toHaveLength(1);
    expect(result[0]?.content).toBe("hello");
    expect(result[0]?.index).toBe(0);
  });

  it("returns single chunk when text length equals chunkSize", () => {
    const strategy = new FixedSizeChunkingStrategy(5, 0);
    const result = strategy.chunk("hello");
    expect(result).toHaveLength(1);
    expect(result[0]?.content).toBe("hello");
  });

  it("returns multiple chunks with correct overlap", () => {
    // chunkSize=6, overlap=2 → step=4
    // "abcdefghij" (10 chars)
    // chunk0: [0,6) = "abcdef"
    // chunk1: [4,10) = "efghij"
    const strategy = new FixedSizeChunkingStrategy(6, 2);
    const result = strategy.chunk("abcdefghij");
    expect(result).toHaveLength(2);
    expect(result[0]?.content).toBe("abcdef");
    expect(result[1]?.content).toBe("efghij");
  });

  it("last chunk ends at text boundary, not at chunkSize", () => {
    // chunkSize=4, overlap=0, text="abcde" (5 chars)
    // chunk0: "abcd", chunk1: "e"
    const strategy = new FixedSizeChunkingStrategy(4, 0);
    const result = strategy.chunk("abcde");
    expect(result).toHaveLength(2);
    expect(result[1]?.content).toBe("e");
  });

  it("chunk indices start at 0 and increment by 1", () => {
    const strategy = new FixedSizeChunkingStrategy(3, 0);
    const result = strategy.chunk("abcdefghi");
    expect(result.map((r) => r.index)).toEqual([0, 1, 2]);
  });
});

/**
 * @test-suite  SemanticChunkingStrategy — chunk()
 * @target      semantic chunking fallback to fixed
 * @strategy    unit, no dependencies
 * @cases
 *   - [PASS] produces same output as FixedSizeChunkingStrategy for same parameters
 */
describe("SemanticChunkingStrategy — chunk()", () => {
  it("produces same output as FixedSizeChunkingStrategy for same parameters", () => {
    const semantic = new SemanticChunkingStrategy(10, 2);
    const fixed = new FixedSizeChunkingStrategy(10, 2);
    const text = "The quick brown fox jumps over the lazy dog";
    expect(semantic.chunk(text)).toEqual(fixed.chunk(text));
  });
});

/**
 * @test-suite  createChunkingStrategy
 * @target      factory function returning correct strategy instance
 * @strategy    unit, no dependencies
 * @cases
 *   - [PASS] returns FixedSizeChunkingStrategy when strategy is "fixed"
 *   - [PASS] returns SemanticChunkingStrategy when strategy is "semantic"
 */
describe("createChunkingStrategy", () => {
  it('returns FixedSizeChunkingStrategy when strategy is "fixed"', () => {
    const s = createChunkingStrategy({ strategy: "fixed", chunkSize: 100, chunkOverlap: 10 });
    expect(s).toBeInstanceOf(FixedSizeChunkingStrategy);
  });

  it('returns SemanticChunkingStrategy when strategy is "semantic"', () => {
    const s = createChunkingStrategy({ strategy: "semantic", chunkSize: 100, chunkOverlap: 10 });
    expect(s).toBeInstanceOf(SemanticChunkingStrategy);
  });
});

/**
 * @test-suite  stripMarkdown
 * @target      Markdown syntax removal for clean embedding text
 * @strategy    unit, no dependencies
 * @cases
 *   - [PASS] removes fenced code blocks
 *   - [PASS] removes inline code backticks but keeps content
 *   - [PASS] removes heading markers
 *   - [PASS] removes bold ** markers but keeps content
 *   - [PASS] removes bold __ markers but keeps content
 *   - [PASS] removes italic * markers but keeps content
 *   - [PASS] removes italic _ markers but keeps content
 *   - [PASS] removes strikethrough ~~ markers but keeps content
 *   - [PASS] replaces image with alt text
 *   - [PASS] replaces link with link text
 *   - [PASS] removes unordered list markers
 *   - [PASS] removes ordered list markers
 *   - [PASS] removes blockquote markers
 *   - [PASS] removes horizontal rule lines
 *   - [PASS] removes table row lines
 */
describe("stripMarkdown", () => {
  it("removes fenced code blocks", () => {
    const input = "Before\n```js\nconst x = 1;\n```\nAfter";
    expect(stripMarkdown(input)).not.toContain("```");
    expect(stripMarkdown(input)).toContain("Before");
    expect(stripMarkdown(input)).toContain("After");
  });

  it("removes inline code backticks but keeps content", () => {
    expect(stripMarkdown("Use `console.log` for debugging")).toContain("console.log");
    expect(stripMarkdown("Use `console.log` for debugging")).not.toContain("`");
  });

  it("removes heading markers", () => {
    expect(stripMarkdown("## Section Title")).toBe("Section Title");
    expect(stripMarkdown("# Top Level")).toBe("Top Level");
  });

  it("removes bold ** markers but keeps content", () => {
    expect(stripMarkdown("This is **important** text")).toBe("This is important text");
  });

  it("removes bold __ markers but keeps content", () => {
    expect(stripMarkdown("This is __important__ text")).toBe("This is important text");
  });

  it("removes italic * markers but keeps content", () => {
    expect(stripMarkdown("This is *emphasized* text")).toBe("This is emphasized text");
  });

  it("removes italic _ markers but keeps content", () => {
    expect(stripMarkdown("This is _emphasized_ text")).toBe("This is emphasized text");
  });

  it("removes strikethrough ~~ markers but keeps content", () => {
    expect(stripMarkdown("This is ~~deleted~~ text")).toBe("This is deleted text");
  });

  it("replaces image with alt text", () => {
    expect(stripMarkdown("![logo](https://example.com/logo.png)")).toBe("logo");
  });

  it("replaces link with link text", () => {
    expect(stripMarkdown("[click here](https://example.com)")).toBe("click here");
  });

  it("removes unordered list markers", () => {
    const input = "- item one\n- item two";
    const result = stripMarkdown(input);
    expect(result).not.toMatch(/^[-*+]\s/m);
    expect(result).toContain("item one");
  });

  it("removes ordered list markers", () => {
    const input = "1. first\n2. second";
    const result = stripMarkdown(input);
    expect(result).not.toMatch(/^\d+\.\s/m);
    expect(result).toContain("first");
  });

  it("removes blockquote markers", () => {
    expect(stripMarkdown("> quoted text")).toBe("quoted text");
  });

  it("removes horizontal rule lines", () => {
    const input = "Above\n---\nBelow";
    const result = stripMarkdown(input);
    expect(result).not.toContain("---");
    expect(result).toContain("Above");
    expect(result).toContain("Below");
  });

  it("removes table row lines", () => {
    const input = "| Col A | Col B |\n| val1  | val2  |";
    const result = stripMarkdown(input);
    expect(result).not.toContain("|");
  });
});
