import type { UserSession } from "../shared/types";

export const COMMISSIONER_DASHBOARD_ROUTE = "/commissioner/dashboard";
export const COMMISSIONER_VISITS_ROUTE = "/commissioner/visits";
export const ROLE_MANAGER_USERS_ROUTE = "/rolemanager/users";

const COMMISSIONER_ROUTES = [COMMISSIONER_DASHBOARD_ROUTE, COMMISSIONER_VISITS_ROUTE];

// The route a commissioner or role-manager session should be moved to, or null to
// stay put. Each role has its own list and the other's routes are not on it, so a
// commissioner who types the user-administration address is sent to the dashboard
// instead of reaching a screen the server would refuse.
export function adminLanding(session: UserSession, pathname: string): string | null {
  if (session.role === "rolemanager")
    return pathname === ROLE_MANAGER_USERS_ROUTE ? null : ROLE_MANAGER_USERS_ROUTE;
  if (session.role === "commissioner")
    return COMMISSIONER_ROUTES.includes(pathname) ? null : COMMISSIONER_DASHBOARD_ROUTE;
  return null;
}
