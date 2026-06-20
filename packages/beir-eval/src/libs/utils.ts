export function vecStr(v: number[]): string {
  return `[${v.join(",")}]`;
}

export function buildChunkingConfig(
  strategy: string,
  chunkSize: number,
  chunkOverlap: number,
): string {
  return `${strategy}-${chunkSize}-${chunkOverlap}`;
}
