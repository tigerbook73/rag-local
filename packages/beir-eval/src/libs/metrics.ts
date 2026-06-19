export function ndcgAtK(hits: string[], relevant: Map<string, number>, k: number): number {
  let dcg = 0;
  for (let rank = 0; rank < Math.min(hits.length, k); rank++) {
    const rel = relevant.get(hits[rank]!) ?? 0;
    dcg += (Math.pow(2, rel) - 1) / Math.log2(rank + 2);
  }
  const idealRels = [...relevant.values()].sort((a, b) => b - a).slice(0, k);
  const idcg = idealRels.reduce((sum, r, i) => sum + (Math.pow(2, r) - 1) / Math.log2(i + 2), 0);
  return idcg > 0 ? dcg / idcg : 0;
}

export function recallAtK(hits: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0) return 0;
  const topK = new Set(hits.slice(0, k));
  return [...relevant].filter((d) => topK.has(d)).length / relevant.size;
}

export function mrrAtK(hits: string[], relevant: Set<string>, k: number): number {
  for (let rank = 0; rank < Math.min(hits.length, k); rank++) {
    if (relevant.has(hits[rank]!)) return 1 / (rank + 1);
  }
  return 0;
}
