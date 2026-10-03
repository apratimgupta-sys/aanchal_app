export type MutationIntent = { key: string; requestId: string };
// Keep the identifier while the payload is unchanged so lost responses can be retried.
export function mutationIntent(
  previous: MutationIntent | null,
  payload: unknown,
): MutationIntent {
  const key = JSON.stringify(payload);
  return previous?.key === key
    ? previous
    : { key, requestId: crypto.randomUUID() };
}
