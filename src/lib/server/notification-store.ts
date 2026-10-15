import { supabaseAdmin } from "./supabase-admin";
import type {
  NotificationDto,
  NotificationStatus,
  ReleasedBy,
  WasteStatus,
} from "../notification-types";

export type { NotificationDto, NotificationStatus, ReleasedBy, WasteStatus };

const COUNTDOWN_MS = 5 * 60 * 1000;
const RESET_DELAY_MS = 90 * 1000;
const FULL_LEVEL = 100;
const REARM_BELOW = 50;
const STATE_ROW_ID = 1;

type StateRow = {
  id: number;
  waste_status: WasteStatus;
  fill_level: number;
  notification_status: NotificationStatus | "EXPIRED";
  notification_sent_at: string | null;
  acknowledged_at: string | null;
  released_at: string | null;
  released_by: ReleasedBy;
  reset_at: string | null;
  release_armed: boolean | null;
  full_override_active: boolean | null;
  actual_fill_level: number | null;
};

type ResolvedKind = "ACKNOWLEDGED" | "RELEASED";

function toEpoch(iso: string | null): number | null {
  return iso ? new Date(iso).getTime() : null;
}

function currentStatus(row: StateRow): NotificationStatus {
  return row.notification_status === "EXPIRED" ? "RELEASED" : row.notification_status;
}

function resetDeadline(row: StateRow): number | null {
  const stored = toEpoch(row.reset_at);
  if (stored !== null) return stored;
  const base =
    toEpoch(row.released_at) ?? toEpoch(row.acknowledged_at) ?? toEpoch(row.notification_sent_at);
  return base === null ? null : base + RESET_DELAY_MS;
}

function toDto(row: StateRow): NotificationDto {
  const now = Date.now();
  const status = currentStatus(row);
  const sentAt = toEpoch(row.notification_sent_at);
  const resetAt = status === "ACKNOWLEDGED" || status === "RELEASED" ? resetDeadline(row) : null;

  const remainingMs =
    status === "SENT" && sentAt !== null ? Math.max(0, COUNTDOWN_MS - (now - sentAt)) : 0;
  const resetRemainingMs = resetAt !== null ? Math.max(0, resetAt - now) : 0;

  return {
    wasteStatus: row.waste_status,
    fillLevel: row.fill_level,
    actualFillLevel: row.actual_fill_level,
    notificationStatus: status,
    notificationSentAt: sentAt,
    acknowledgedAt: toEpoch(row.acknowledged_at),
    releasedAt: status === "RELEASED" ? toEpoch(row.released_at) : null,
    releasedBy: status === "RELEASED" ? row.released_by : null,
    resetAt,
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    resetRemainingMs,
    windowSeconds: COUNTDOWN_MS / 1000,
    resetSeconds: RESET_DELAY_MS / 1000,
    releaseArmed: row.release_armed === true,
    fullOverrideActive: row.full_override_active === true,
    serverTime: now,
  };
}

async function fetchRow(): Promise<StateRow> {
  const { data, error } = await supabaseAdmin
    .from("notification_state")
    .select("*")
    .eq("id", STATE_ROW_ID)
    .single();

  if (error || !data) {
    throw new Error(`[notification-store] Read failed: ${error?.message ?? "no data"}`);
  }
  return data as StateRow;
}

async function saveRow(patch: Partial<StateRow>): Promise<StateRow> {
  const { data, error } = await supabaseAdmin
    .from("notification_state")
    .update(patch)
    .eq("id", STATE_ROW_ID)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[notification-store] Update failed: ${error?.message ?? "no data"}`);
  }
  return data as StateRow;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Guard = (query: any) => any;

async function updateIf(patch: Partial<StateRow>, guard: Guard): Promise<StateRow | null> {
  const query = supabaseAdmin.from("notification_state").update(patch).eq("id", STATE_ROW_ID);
  const { data, error } = await guard(query).select().maybeSingle();

  if (error) {
    throw new Error(`[notification-store] Conditional update failed: ${error.message}`);
  }
  return (data as StateRow | null) ?? null;
}

async function logHistory(row: StateRow, kind: ResolvedKind): Promise<void> {
  const { error } = await supabaseAdmin.from("notification_history").insert({
    notification_sent_at: row.notification_sent_at,
    acknowledged_at: row.acknowledged_at,
    released_at: row.released_at,
    released_by: row.released_by,
    fill_level: row.fill_level,
    status: kind,
    reset_at: row.reset_at,
  });

  if (error) {
    console.error("[notification-store] History insert failed:", error.message);
  }
}

async function autoReleaseIfExpired(row: StateRow): Promise<StateRow> {
  const sentAt = toEpoch(row.notification_sent_at);
  if (currentStatus(row) !== "SENT" || sentAt === null || Date.now() - sentAt < COUNTDOWN_MS) {
    return row;
  }

  const now = Date.now();
  const updated = await updateIf(
    {
      notification_status: "RELEASED",
      released_at: new Date(now).toISOString(),
      released_by: "auto",
      reset_at: new Date(now + RESET_DELAY_MS).toISOString(),
    },
    (q) =>
      q
        .eq("notification_status", "SENT")
        .lte("notification_sent_at", new Date(now - COUNTDOWN_MS).toISOString()),
  );

  if (!updated) return fetchRow();
  await logHistory(updated, "RELEASED");
  return updated;
}

async function resetIfDue(row: StateRow): Promise<StateRow> {
  const status = currentStatus(row);
  if (status !== "ACKNOWLEDGED" && status !== "RELEASED") return row;

  const deadline = resetDeadline(row);
  if (deadline === null || Date.now() < deadline) return row;

  const updated = await updateIf(
    {
      notification_status: "NOT_SENT",
      notification_sent_at: null,
      acknowledged_at: null,
      released_at: null,
      released_by: null,
      reset_at: null,
      release_armed: row.fill_level < REARM_BELOW,
      waste_status: row.fill_level >= FULL_LEVEL ? "FULL" : "NOT_FULL",
    },
    (q) => q.in("notification_status", ["ACKNOWLEDGED", "RELEASED", "EXPIRED"]).lte("reset_at", new Date().toISOString()),
  );

  return updated ?? fetchRow();
}

async function loadCurrent(): Promise<StateRow> {
  let row = await fetchRow();
  row = await autoReleaseIfExpired(row);
  row = await resetIfDue(row);
  return row;
}

function validLevel(level: number): number {
  if (!Number.isFinite(level) || level < 0 || level > 100) {
    throw new Error("Fill level must be a number from 0 to 100.");
  }
  return Math.round(level);
}

async function applyEffectiveLevel(
  row: StateRow,
  level: number,
  extra: Partial<StateRow> = {},
): Promise<StateRow> {
  const base: Partial<StateRow> = {
    ...extra,
    fill_level: level,
    waste_status: level >= FULL_LEVEL ? "FULL" : "NOT_FULL",
  };

  if (currentStatus(row) !== "NOT_SENT") {
    return saveRow(base);
  }

  if (level < REARM_BELOW) {
    return saveRow({ ...base, release_armed: true });
  }

  if (level >= FULL_LEVEL && row.release_armed === true) {
    const started = await updateIf(
      {
        ...base,
        notification_status: "SENT",
        notification_sent_at: new Date(Date.now()).toISOString(),
        acknowledged_at: null,
        released_at: null,
        released_by: null,
        reset_at: null,
        release_armed: false,
      },
      (q) => q.eq("notification_status", "NOT_SENT").eq("release_armed", true),
    );
    if (started) return started;
    return fetchRow();
  }

  return saveRow(base);
}

export async function getNotificationState(): Promise<NotificationDto> {
  return toDto(await loadCurrent());
}

export async function reportSensorReading(fillLevel: number): Promise<NotificationDto> {
  const level = validLevel(fillLevel);
  const row = await loadCurrent();

  if (row.full_override_active === true) {
    const updated = await saveRow({ actual_fill_level: level });
    return toDto(updated);
  }

  return toDto(await applyEffectiveLevel(row, level, { actual_fill_level: level }));
}

export async function setSimulatedFillLevel(fillLevel: number): Promise<NotificationDto> {
  const level = validLevel(fillLevel);
  const row = await loadCurrent();

  if (row.full_override_active !== true) {
    throw new BypassRequiredError();
  }

  return toDto(await applyEffectiveLevel(row, level));
}

export async function setBypassEnabled(enabled: boolean): Promise<NotificationDto> {
  const row = await loadCurrent();
  if ((row.full_override_active === true) === enabled) return toDto(row);

  if (enabled) {
    const updated = await updateIf(
      {
        full_override_active: true,
        actual_fill_level: row.actual_fill_level ?? row.fill_level,
      },
      (q) => q.or("full_override_active.is.null,full_override_active.eq.false"),
    );
    return toDto(updated ?? (await fetchRow()));
  }

  const switched = await updateIf({ full_override_active: false }, (q) =>
    q.eq("full_override_active", true),
  );
  if (!switched) return toDto(await fetchRow());

  const actual = switched.actual_fill_level;
  if (actual === null || actual === undefined) return toDto(switched);
  return toDto(await applyEffectiveLevel(switched, actual));
}

export async function isBypassActive(): Promise<boolean> {
  const row = await fetchRow();
  return row.full_override_active === true;
}

export class BypassRequiredError extends Error {
  constructor() {
    super("Turn Bypass Mode ON first.");
  }
}

export type TransitionResult = { performed: boolean; state: NotificationDto };

export async function acknowledgeNotification(): Promise<TransitionResult> {
  const row = await loadCurrent();
  if (currentStatus(row) !== "SENT") return { performed: false, state: toDto(row) };

  const now = Date.now();
  const updated = await updateIf(
    {
      notification_status: "ACKNOWLEDGED",
      acknowledged_at: new Date(now).toISOString(),
      reset_at: new Date(now + RESET_DELAY_MS).toISOString(),
    },
    (q) => q.eq("notification_status", "SENT").eq("notification_sent_at", row.notification_sent_at),
  );

  if (!updated) return { performed: false, state: toDto(await fetchRow()) };
  await logHistory(updated, "ACKNOWLEDGED");
  return { performed: true, state: toDto(updated) };
}

export async function releaseNotification(): Promise<TransitionResult> {
  const row = await loadCurrent();
  if (currentStatus(row) !== "SENT") return { performed: false, state: toDto(row) };

  const now = Date.now();
  const updated = await updateIf(
    {
      notification_status: "RELEASED",
      released_at: new Date(now).toISOString(),
      released_by: "manual",
      reset_at: new Date(now + RESET_DELAY_MS).toISOString(),
    },
    (q) => q.eq("notification_status", "SENT").eq("notification_sent_at", row.notification_sent_at),
  );

  if (!updated) return { performed: false, state: toDto(await fetchRow()) };
  await logHistory(updated, "RELEASED");
  return { performed: true, state: toDto(updated) };
}
