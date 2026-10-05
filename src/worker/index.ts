import { authenticate, cookie, tokenHash, verifyPassword } from "./auth";
import { fail, HttpError, json } from "./errors";
import { Repository } from "./repository";
import {
  deriveEntryViews,
  summarizePeriod,
  todayIST,
  validDate,
} from "../domain/ledger";
import services from "../shared/services.json";
import type {
  SaveCommand,
  SetupCommand,
  StoredEntry,
  EntryView,
} from "../shared/types";
export { OfficeCoordinator } from "./office-coordinator";
export { DashboardHub } from "./dashboard-hub";
function mutationResponse(result: {
  value?: unknown;
  error?: unknown;
  status?: number;
}) {
  return result.error ? json(result.error, result.status) : json(result.value);
}
async function body(request: Request) {
  const text = await request.text();
  if (text.length > 50000) fail(413, "Request too large");
  try {
    return JSON.parse(text);
  } catch {
    fail(400, "Invalid JSON");
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url),
        path = url.pathname;
      if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
      if (!["GET", "HEAD"].includes(request.method) || path === "/api/live") {
        if (request.headers.get("origin") !== url.origin)
          fail(403, "Same-origin request required");
      }
      if (path === "/api/login" && request.method === "POST") {
        const data = await body(request);
        if (
          typeof data.username !== "string" ||
          typeof data.password !== "string" ||
          data.username.length > 80 ||
          data.password.length > 200
        )
          fail(400, "Enter username and password");
        const key = await tokenHash(
          (request.headers.get("CF-Connecting-IP") ?? "local") +
            ":" +
            data.username.toLowerCase(),
        );
        if (
          !(await env.OFFICES.getByName("login:" + key.slice(0, 16)).limitLogin(
            key,
          ))
        )
          fail(429, "Too many attempts. Try again in one minute.");
        const user = await env.DB.prepare(
          "SELECT id,password_hash FROM users WHERE username=?",
        )
          .bind(data.username.toLowerCase())
          .first<{ id: string; password_hash: string }>();
        if (!user || !(await verifyPassword(data.password, user.password_hash)))
          fail(401, "Invalid username or password", "LOGIN");
        const token = crypto.randomUUID() + crypto.randomUUID();
        await env.DB.prepare("INSERT INTO sessions VALUES(?,?,?)")
          .bind(await tokenHash(token), user.id, Date.now() + 28800000)
          .run();
        return json({ ok: true }, 200, {
          "Set-Cookie": cookie(token, request),
        });
      }
      const session = await authenticate(request, env.DB);
      if (!session) fail(401, "Please sign in", "UNAUTHORIZED");
      if (path === "/api/session") return json(session);
      if (path === "/api/logout" && request.method === "POST") {
        const token = request.headers
          .get("cookie")
          ?.match(/rmc_session=([^;]+)/)?.[1];
        if (token)
          await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
            .bind(await tokenHash(token))
            .run();
        return json({ ok: true }, 200, {
          "Set-Cookie": cookie("", request, 0),
        });
      }
      if (path === "/api/services") return json(services);
      const repo = new Repository(env.DB);
      if (path === "/api/history" && request.method === "GET")
        return json(
          await repo.getAudit(
            session.role === "office" ? session.officeId! : undefined,
          ),
        );
      if (path === "/api/live") {
        if (session.role !== "commissioner")
          fail(403, "Commissioner access required");
        const headers = new Headers(request.headers);
        headers.set(
          "x-session-hash",
          await tokenHash(
            request.headers.get("cookie")!.match(/rmc_session=([^;]+)/)![1],
          ),
        );
        return env.HUB.getByName("commissioner").fetch(
          new Request(request, { headers }),
        );
      }
      if (path.startsWith("/api/office/")) {
        if (session.role !== "office" || !session.officeId)
          fail(403, "Office access required");
        const office = session.officeId,
          stub = env.OFFICES.getByName("office:" + office);
        if (path === "/api/office/setup") {
          if (request.method === "GET")
            return json(await repo.getSetup(office));
          if (request.method === "PUT")
            return mutationResponse(
              await stub.saveSetup(
                session,
                (await body(request)) as SetupCommand,
              ),
            );
        }
        if (path === "/api/office/entries") {
          if (request.method === "POST")
            return mutationResponse(
              await stub.saveEntry(
                session,
                (await body(request)) as SaveCommand,
              ),
            );
          if (request.method === "GET") {
            const setup = await repo.getSetup(office);
            if (!setup)
              fail(422, "Configure opening balances before reporting");
            const entries = await repo.getEntries(office);
            const date = url.searchParams.get("date") ?? todayIST();
            const mode = url.searchParams.get("mode");
            if (!validDate(date) || (mode !== "today" && mode !== "backdate"))
              fail(422, "Select a valid reporting route and date");
            const yesterday = new Date(`${todayIST()}T00:00:00Z`);
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            const latestBackdate = yesterday.toISOString().slice(0, 10);
            if (
              (mode === "today" && date !== todayIST()) ||
              (mode === "backdate" &&
                (date < setup.startDate || date > latestBackdate))
            )
              fail(422, "Date is outside this reporting route");
            const views: EntryView[] = [];
            for (const b of setup.balances)
              views.push(
                ...deriveEntryViews(
                  b.opening,
                  entries.filter((e) => e.serviceId === b.serviceId),
                ),
              );
            return json({
              setup,
              entries: views.filter((e) => e.serviceDate === date),
              openings: setup.balances.map((b) => ({
                serviceId: b.serviceId,
                opening:
                  deriveEntryViews(
                    b.opening,
                    entries.filter(
                      (e) =>
                        e.serviceId === b.serviceId && e.serviceDate < date,
                    ),
                  ).at(-1)?.closing ?? b.opening,
              })),
            });
          }
        }
        if (path.startsWith("/api/office/entries/") && request.method === "PUT")
          return mutationResponse(
            await stub.saveEntry(
              session,
              (await body(request)) as SaveCommand,
              path.split("/").at(-1),
            ),
          );
      }
      if (path === "/api/dashboard" || path === "/api/dashboard/entries") {
        if (session.role !== "commissioner")
          fail(403, "Commissioner access required");
        if (request.method !== "GET") fail(405, "Read-only endpoint");
        const from = url.searchParams.get("from") ?? todayIST(),
          to = url.searchParams.get("to") ?? from;
        const officeId = url.searchParams.has("officeId")
            ? Number(url.searchParams.get("officeId"))
            : undefined,
          serviceId = url.searchParams.has("serviceId")
            ? Number(url.searchParams.get("serviceId"))
            : undefined;
        if (
          !validDate(from) ||
          !validDate(to) ||
          from > to ||
          to > todayIST() ||
          (officeId !== undefined &&
            (!Number.isInteger(officeId) || officeId < 1 || officeId > 6)) ||
          (serviceId !== undefined &&
            (!Number.isInteger(serviceId) || serviceId < 1 || serviceId > 25))
        )
          fail(422, "Invalid reporting filters");
        const [setups, entries] = await Promise.all([
          repo.getSetups(),
          repo.getEntries(),
        ]);
        if (path.endsWith("/entries")) {
          const views: EntryView[] = [];
          for (const setup of setups)
            for (const b of setup.balances)
              views.push(
                ...deriveEntryViews(
                  b.opening,
                  entries.filter(
                    (e) =>
                      e.officeId === setup.officeId &&
                      e.serviceId === b.serviceId,
                  ),
                ),
              );
          return json(
            views.filter(
              (e) =>
                e.serviceDate >= from &&
                e.serviceDate <= to &&
                (!officeId || e.officeId === officeId) &&
                (!serviceId || e.serviceId === serviceId),
            ),
          );
        }
        return json({
          rows: summarizePeriod(
            setups,
            entries,
            { from, to, officeId, serviceId },
            todayIST(),
          ),
          updatedAt: new Date().toISOString(),
        });
      }
      fail(404, "Endpoint not found");
    } catch (error) {
      if (error instanceof HttpError) return json(error.detail, error.status);
      console.error(
        "Request failed",
        error instanceof Error ? error.message : "unknown",
      );
      return json(
        {
          code: "INTERNAL",
          message: "Unable to complete request. Please retry.",
        },
        500,
      );
    }
  },
};
