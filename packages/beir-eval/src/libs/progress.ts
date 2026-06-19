export function printProgress(done: number, total: number, label: string): void {
  const pct = String(Math.round((done / total) * 100)).padStart(3);
  process.stdout.write(`\r[${pct}%] ${label}: ${done}/${total}`);
  if (done >= total) console.log();
}
