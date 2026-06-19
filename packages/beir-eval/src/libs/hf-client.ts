const HF_API = "https://datasets-server.huggingface.co/rows";
const HF_DATASETS_API = "https://huggingface.co/api/datasets";
const PAGE_SIZE = 100;

interface HfRow<T> {
  row: T;
}

interface HfResponse<T> {
  rows: HfRow<T>[];
  num_rows_total: number;
}

async function fetchPage<T>(
  dataset: string,
  config: string,
  split: string,
  offset: number,
): Promise<HfResponse<T>> {
  const url = `${HF_API}?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=${offset}&length=${PAGE_SIZE}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HuggingFace API ${res.status}: ${body}`);
  }
  return res.json() as Promise<HfResponse<T>>;
}

export interface HfPage<T> {
  rows: T[];
  total: number;
}

async function* fetchAll<T>(
  dataset: string,
  config: string,
  split: string,
): AsyncGenerator<HfPage<T>> {
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const page = await fetchPage<T>(dataset, config, split, offset);
    total = page.num_rows_total;
    const rows = page.rows.map((r) => r.row);
    if (rows.length === 0) break;
    yield { rows, total };
    offset += rows.length;
  }
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

export function fetchCorpus(dataset: string): AsyncGenerator<HfPage<HfCorpusRow>> {
  return fetchAll<HfCorpusRow>(`BeIR/${dataset}`, "corpus", "corpus");
}

export function fetchQueries(dataset: string): AsyncGenerator<HfPage<HfQueryRow>> {
  return fetchAll<HfQueryRow>(`BeIR/${dataset}`, "queries", "queries");
}

export function fetchQrels(dataset: string): AsyncGenerator<HfPage<HfQrelRow>> {
  return fetchAll<HfQrelRow>(`BeIR/${dataset}-qrels`, "default", "test");
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
