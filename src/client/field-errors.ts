// The API reports field errors under JSON paths ("input.received", "balances[3].opening.field",
// "startDate"). These helpers translate them to the keys the forms use.

export function normalizeFieldErrors(
  errors?: Record<string, string> | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors ?? {}))
    out[key.replace(/^input\./, "")] = message;
  return out;
}

export function setupErrorTarget(key: string): string | null {
  if (key === "startDate") return "date";
  const match = /^balances\[(\d+)\]\.opening\.(service|complaints|field)$/.exec(key);
  return match ? `balances.${match[1]}.opening.${match[2]}` : null;
}
