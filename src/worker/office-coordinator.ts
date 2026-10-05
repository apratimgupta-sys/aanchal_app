import { DurableObject } from "cloudflare:workers";
import { Repository } from "./repository";
import { fail, HttpError } from "./errors";
import {
  deriveEntryViews,
  todayIST,
  dateIST,
  validateEntry,
  validDate,
} from "../domain/ledger";
import type {
  UserSession,
  SaveCommand,
  SetupCommand,
  StoredEntry,
  Setup,
} from "../shared/types";
export class OfficeCoordinator extends DurableObject<Env> {
  private queue: Promise<unknown> = Promise.resolve();
  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => undefined);
    return result;
  }
  async limitLogin(key: string): Promise<boolean> {
    return this.serialize(async () => {
      const now = Date.now();
      const old = await this.ctx.storage.get<{ at: number; n: number }>(
        "login:" + key,
      );
      const v =
        old && now - old.at < 60000
          ? { at: old.at, n: old.n + 1 }
          : { at: now, n: 1 };
      await this.ctx.storage.put("login:" + key, v);
      return v.n <= 10;
    });
  }
  async saveEntry(session: UserSession, command: SaveCommand, id?: string) {
    return this.serialize(() => this.safeMutate(session, command, "entry", id));
  }
  async saveSetup(session: UserSession, command: SetupCommand) {
    return this.serialize(() => this.safeMutate(session, command, "setup"));
  }
  private async safeMutate(
    session: UserSession,
    command: SaveCommand | SetupCommand,
    kind: "entry" | "setup",
    id?: string,
  ) {
    try {
      return { value: await this.mutate(session, command, kind, id) };
    } catch (e) {
      if (e instanceof HttpError) return { error: e.detail, status: e.status };
      throw e;
    }
  }
  private async mutate(
    session: UserSession,
    command: SaveCommand | SetupCommand,
    kind: "entry" | "setup",
    id?: string,
  ) {
    if (session.role !== "office" || !session.officeId)
      fail(403, "Office access required");
    const office = session.officeId;
    if (
      !command ||
      typeof command.requestId !== "string" ||
      !/^[a-zA-Z0-9_-]{8,100}$/.test(command.requestId)
    )
      fail(422, "Invalid request identifier");
    const fingerprint = JSON.stringify({ kind, id, command });
    const receipt = await this.env.DB.prepare(
      "SELECT fingerprint,response FROM mutation_receipts WHERE office_id=? AND request_id=?",
    )
      .bind(office, command.requestId)
      .first<{ fingerprint: string; response: string }>();
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        fail(
          409,
          "This request identifier was already used for different data",
        );
      return JSON.parse(receipt.response);
    }
    const repo = new Repository(this.env.DB);
    const setup = await repo.getSetup(office);
    const entries = await repo.getEntries(office);
    const statements: D1PreparedStatement[] = [];
    let before: unknown = null;
    let after: unknown;
    let action: string;
    if (kind === "setup") {
      const c = command as SetupCommand;
      if (setup)
        fail(
          409,
          "Opening balances have already been set and cannot be changed",
        );
      if (!validDate(c.startDate) || c.startDate > todayIST())
        fail(422, "Enter a valid reporting start date through today");
      if (
        !Array.isArray(c.balances) ||
        c.balances.length !== 25 ||
        new Set(c.balances.map((b) => b.serviceId)).size !== 25 ||
        c.balances.some(
          (b) =>
            !Number.isInteger(b.serviceId) ||
            b.serviceId < 1 ||
            b.serviceId > 25 ||
            !b.opening ||
            Object.keys(b.opening).length !== 3 ||
            ["service", "complaints", "field"].some(
              (k) =>
                !Number.isSafeInteger(b.opening[k as keyof typeof b.opening]) ||
                b.opening[k as keyof typeof b.opening] < 0 ||
                b.opening[k as keyof typeof b.opening] > 1e9,
            ),
        )
      )
        fail(422, "Confirm nonnegative opening balances for all 25 services");
      if (c.expectedVersion !== null)
        fail(
          409,
          "Initial balances changed. Reload before correcting.",
          "CONFLICT",
        );
      if (entries.some((e) => e.serviceDate < c.startDate))
        fail(422, "Start date cannot exclude existing reports");
      before = null;
      after = {
        officeId: office,
        startDate: c.startDate,
        balances: c.balances,
        version: 1,
      } satisfies Setup;
      for (const b of c.balances)
        this.checkHistory(
          b.opening,
          entries.filter((e) => e.serviceId === b.serviceId),
        );
      statements.push(
        this.env.DB.prepare(
          "INSERT INTO office_setup VALUES(?,?,?) ON CONFLICT(office_id) DO UPDATE SET start_date=excluded.start_date,version=excluded.version",
        ).bind(office, c.startDate, (after as Setup).version),
      );
      for (const b of c.balances)
        statements.push(
          this.env.DB.prepare(
            "INSERT INTO initial_balances VALUES(?,?,?,?,?) ON CONFLICT(office_id,service_id) DO UPDATE SET service=excluded.service,complaints=excluded.complaints,field=excluded.field",
          ).bind(
            office,
            b.serviceId,
            b.opening.service,
            b.opening.complaints,
            b.opening.field,
          ),
        );
      action = "Initial balances configured";
    } else {
      const c = command as SaveCommand;
      if (!setup) fail(422, "Configure opening balances before reporting");
      if (c.mode !== "today" && c.mode !== "backdate")
        fail(422, "Select Today’s Entry or Backdate Entry");
      if (!c.input || typeof c.input !== "object") fail(422, "Entry required");
      const error = validateEntry(c.input, todayIST());
      if (error) throw new HttpError(422, error);
      const today = todayIST();
      if (
        (c.mode === "today" && c.input.serviceDate !== today) ||
        (c.mode === "backdate" &&
          (c.input.serviceDate < setup.startDate ||
            c.input.serviceDate >= today))
      )
        fail(422, "Service date is outside this reporting route");
      const old = id
        ? entries.find((e) => e.id === id)
        : entries.find(
            (e) =>
              e.serviceDate === c.input.serviceDate &&
              e.serviceId === c.input.serviceId,
          );
      if (id && !old) fail(404, "Entry not found");
      if (
        id &&
        (old!.serviceId !== c.input.serviceId ||
          old!.serviceDate !== c.input.serviceDate)
      )
        fail(422, "Service/date identity cannot be changed by correction");
      if ((old?.version ?? null) !== c.expectedVersion)
        fail(409, "Entry changed. Reload before correcting.", "CONFLICT");
      if (
        (old || (c.mode === "backdate" && c.input.serviceDate < today)) &&
        (typeof c.reason !== "string" ||
          !c.reason.trim() ||
          c.reason.length > 1000)
      )
        fail(
          422,
          old
            ? "A correction reason is required"
            : "A delayed-reporting reason is required",
        );
      const now = new Date().toISOString();
      const input = c.input;
      const record: StoredEntry = {
        received: input.received,
        completed: input.completed,
        slaWithinTime: input.slaWithinTime,
        amountPaise: input.amountPaise,
        complaintsReceived: input.complaintsReceived,
        complaintsResolved: input.complaintsResolved,
        fieldReceived: input.fieldReceived,
        fieldCompleted: input.fieldCompleted,
        serviceId: input.serviceId,
        serviceDate: input.serviceDate,
        reportingDate: old?.reportingDate ?? dateIST(new Date(now)),
        ward: input.ward.trim(),
        avgDisposalDays: input.completed ? input.avgDisposalDays : null,
        remarks: input.remarks.trim(),
        id: old?.id ?? crypto.randomUUID(),
        officeId: office,
        version: (old?.version ?? 0) + 1,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
      };
      const balance = setup.balances.find(
        (b) => b.serviceId === record.serviceId,
      )!.opening;
      const views = this.checkHistory(balance, [
        ...entries.filter(
          (e) => e.serviceId === record.serviceId && e.id !== record.id,
        ),
        record,
      ]);
      before = old ?? null;
      after = views.find((e) => e.id === record.id)!;
      action = old ? "Entry corrected" : "Entry submitted";
      statements.push(
        this.env.DB.prepare(
          "INSERT INTO daily_entries VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,data=excluded.data",
        ).bind(
          record.id,
          office,
          record.serviceId,
          record.serviceDate,
          record.version,
          JSON.stringify(record),
        ),
      );
    }
    const revision =
      (
        await this.env.DB.prepare(
          "SELECT revision FROM office_revisions WHERE office_id=?",
        )
          .bind(office)
          .first<{ revision: number }>()
      )?.revision ?? 0;
    statements.push(
      this.env.DB.prepare(
        "INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?)",
      ).bind(
        crypto.randomUUID(),
        office,
        session.username,
        new Date().toISOString(),
        action,
        command.reason ?? null,
        before ? JSON.stringify(before) : null,
        JSON.stringify(after),
      ),
      this.env.DB.prepare(
        "INSERT INTO office_revisions VALUES(?,?) ON CONFLICT(office_id) DO UPDATE SET revision=excluded.revision",
      ).bind(office, revision + 1),
      this.env.DB.prepare("INSERT INTO mutation_receipts VALUES(?,?,?,?)").bind(
        office,
        command.requestId,
        fingerprint,
        JSON.stringify(after),
      ),
    );
    await this.env.DB.batch(statements);
    this.ctx.waitUntil(
      this.env.HUB.getByName("commissioner")
        .publish({
          type: "invalidate",
          officeId: office,
          revision: revision + 1,
        })
        .catch(() => {
          console.error(
            "Dashboard notification failed; fallback refresh will recover",
          );
        }),
    );
    return after;
  }
  private checkHistory(
    opening: Setup["balances"][number]["opening"],
    entries: StoredEntry[],
  ) {
    try {
      return deriveEntryViews(opening, entries);
    } catch (e) {
      fail(422, (e as Error).message);
    }
  }
}
