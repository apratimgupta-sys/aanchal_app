import type { QueryClient } from "@tanstack/react-query";

// One officer's records must not survive into the next officer's session on a
// shared field phone, where the SPA stays mounted across a sign-out.
export function clearSessionCaches(queryClient: QueryClient): void {
  queryClient.clear();
}

export function myVisitsQueryKey(
  officerId: string,
  from: string,
  to: string,
): (string | undefined)[] {
  return ["field-visits", "mine", officerId, from, to];
}
