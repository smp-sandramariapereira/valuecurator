const seen = new Map<string, number>();

export function resetUsageMeter(): void {
  seen.clear();
}

export function recordUsage(requestId: string): { counted: boolean; total: number } {
  const id = requestId.trim();
  if (!id) throw new Error("request id is required");
  if (seen.has(id)) return { counted: false, total: seen.size };
  seen.set(id, Date.now());
  return { counted: true, total: seen.size };
}
