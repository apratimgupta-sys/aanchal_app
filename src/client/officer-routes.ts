import type { UserSession } from "../shared/types";

export const OFFICER_VISIT_ROUTE = "/officer/visit";
export const OFFICER_VISITS_ROUTE = "/officer/visits";
export const OFFICER_PASSWORD_ROUTE = "/officer/password";

const OFFICER_ROUTES = [
  OFFICER_VISIT_ROUTE,
  OFFICER_VISITS_ROUTE,
  OFFICER_PASSWORD_ROUTE,
];

// Returns the route an officer should be moved to, or null to stay put.
// Office and commissioner sessions are not this function's business.
export function officerLanding(
  session: UserSession,
  pathname: string,
): string | null {
  if (session.role !== "officer") return null;
  if (session.mustChangePassword)
    return pathname === OFFICER_PASSWORD_ROUTE ? null : OFFICER_PASSWORD_ROUTE;
  return OFFICER_ROUTES.includes(pathname) ? null : OFFICER_VISIT_ROUTE;
}
