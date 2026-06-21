import { asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects } from "hyparquet";

const HF_DATASETS_API = "https://huggingface.co/api/datasets";
const HF_PARQUET_API = "https://datasets-server.huggingface.co/parquet";

interface ParquetEntry {
  url: string;
  size: number;
}

interface HfParquetApiResponse {
  parquet_files: Array<{
    config: string;
    split: string;
    url: string;
    size: number;
  }>;
}

async function getParquetEntries(dataset: string, config: string, split: string): Promise<ParquetEntry[]> {
  const url = `${HF_PARQUET_API}?dataset=${encodeURIComponent(dataset)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HuggingFace Parquet API ${res.status}: ${body}`);
  }
  const data = (await res.json()) as HfParquetApiResponse;
  return data.parquet_files
    .filter((f) => f.config === config && f.split === split)
    .map((f) => ({ url: f.url, size: f.size }));
}

async function getEntryRowCount(entry: ParquetEntry): Promise<number> {
  const file = await asyncBufferFromUrl({ url: entry.url, byteLength: entry.size });
  const meta = await parquetMetadataAsync(file);
  return Number(meta.num_rows);
}

async function readEntryRows<T>(entry: ParquetEntry): Promise<T[]> {
  const file = await asyncBufferFromUrl({ url: entry.url, byteLength: entry.size });
  const rows = await parquetReadObjects({ file });
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = typeof v === "bigint" ? Number(v) : v;
    }
    return out as T;
  });
}

export interface HfPage<T> {
  rows: T[];
  total: number;
}

export interface HfCorpusRow {
  _id: string;
  title?: string;
  text: string;
}

export interface HfQueryRow {
  _id: string;
  text: string;
}

export interface HfQrelRow {
  "query-id": string;
  "corpus-id": string;
  score: number;
}

export async function getCorpusSize(dataset: string): Promise<number> {
  const entries = await getParquetEntries(`BeIR/${dataset}`, "corpus", "corpus");
  const counts = await Promise.all(entries.map(getEntryRowCount));
  return counts.reduce((sum, n) => sum + n, 0);
}

async function* fetchAllFromParquet<T>(dataset: string, config: string, split: string): AsyncGenerator<HfPage<T>> {
  const entries = await getParquetEntries(dataset, config, split);
  const counts = await Promise.all(entries.map(getEntryRowCount));
  const total = counts.reduce((sum, n) => sum + n, 0);
  for (const entry of entries) {
    const rows = await readEntryRows<T>(entry);
    yield { rows, total };
  }
}

export function fetchCorpus(dataset: string): AsyncGenerator<HfPage<HfCorpusRow>> {
  return fetchAllFromParquet<HfCorpusRow>(`BeIR/${dataset}`, "corpus", "corpus");
}

export function fetchQueries(dataset: string): AsyncGenerator<HfPage<HfQueryRow>> {
  return fetchAllFromParquet<HfQueryRow>(`BeIR/${dataset}`, "queries", "queries");
}

export function fetchQrels(dataset: string): AsyncGenerator<HfPage<HfQrelRow>> {
  return fetchAllFromParquet<HfQrelRow>(`BeIR/${dataset}-qrels`, "default", "test");
}

export interface HfDatasetInfo {
  id: string;
  lastModified: string;
}

export async function fetchBeirDatasets(): Promise<string[]> {
  const url = `${HF_DATASETS_API}?author=BeIR&limit=100`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HuggingFace API ${res.status}: ${body}`);
  }
  const datasets = (await res.json()) as HfDatasetInfo[];
  return datasets
    .map((d) => d.id.replace(/^BeIR\//, "").replace(/-qrels$/, ""))
    .filter((name, idx, arr) => arr.indexOf(name) === idx)
    .sort();
}
