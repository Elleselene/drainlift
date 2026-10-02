// Server-only na "backend" para sa DrainLift notification lifecycle — ngayon ay naka-store
// na sa Supabase (Postgres) sa halip na sa RAM lang ng server, kaya PERMANENTE na ito: hindi
// na nawawala kahit mag-restart o mag-redeploy ang server.
//
// Kailangan munang gawin sa Supabase (SQL editor) ang mga tables na ito bago gumana ang mga
// function sa baba — tingnan ang supabase/schema.sql sa root ng project.
//
//   FULL (unang beses)  -> send notification (SENT)
//   FULL pa rin          -> huwag nang magpadala ulit
//   Acknowledge           -> ACKNOWLEDGED, hindi na kailangan ng actuator
//   Walang acknowledge sa loob ng 5 minuto -> EXPIRED + kusang mag-a-activate ang actuator
//   Manual na "Release" command -> agad i-activate ang actuator
//   NOT_FULL (naalis na ang basura) -> RESET, eligible ulit sa susunod na FULL
//
// Dahil "**/server/**" ang path nito, bawal itong i-import ng anumang client-side code
// (naka-configure ito sa vite.config.ts, importProtection) — ang route files lang sa ilalim
// ng src/routes/api/ ang dapat gumamit nito.

import { supabaseAdmin } from "./supabase-admin";

const NOTIFICATION_WINDOW_MS = 5 * 60 * 1000; // 5 minuto, kagaya ng dating countdown sa dashboard
const FULL_THRESHOLD = 100; // percent — dito ituturing na "FULL" na ang compartment
const STATE_ROW_ID = 1; // iisa lang na row ang notification_state (kasalukuyang buhay na estado)

export type WasteStatus = "FULL" | "NOT_FULL";
export type NotificationStatus = "NOT_SENT" | "SENT" | "ACKNOWLEDGED" | "EXPIRED";
export type ReleasedBy = "manual" | "auto" | null;

// Hugis ng row sa Supabase table na "notification_state" (snake_case, kagaya ng SQL columns)
type StateRow = {
  id: number;
  waste_status: WasteStatus;
  fill_level: number;
  notification_status: NotificationStatus;
  notification_sent_at: string | null; // ISO timestamp
  acknowledged_at: string | null;
  actuator_active: boolean;
  release_armed: boolean;
  released_at: string | null;
  released_by: ReleasedBy;
};

// Ang laman ng DTO na ipinapadala papunta sa dashboard (camelCase + derived na values)
export type NotificationDto = {
  wasteStatus: WasteStatus;
  fillLevel: number;
  notificationStatus: NotificationStatus;
  notificationSentAt: number | null; // epoch ms, mas madaling gamitin sa frontend
  acknowledgedAt: number | null;
  actuatorActive: boolean;
  releaseArmed: boolean;
  releasedAt: number | null;
  releasedBy: ReleasedBy;
  remainingSeconds: number;
  windowSeconds: number;
};

function toEpoch(iso: string | null): number | null {
  return iso ? new Date(iso).getTime() : null;
}

function toDto(row: StateRow): NotificationDto {
  const sentAt = toEpoch(row.notification_sent_at);
  const remainingMs = sentAt ? Math.max(0, NOTIFICATION_WINDOW_MS - (Date.now() - sentAt)) : 0;
  return {
    wasteStatus: row.waste_status,
    fillLevel: row.fill_level,
    notificationStatus: row.notification_status,
    notificationSentAt: sentAt,
    acknowledgedAt: toEpoch(row.acknowledged_at),
    actuatorActive: row.actuator_active,
    releaseArmed: row.release_armed,
    releasedAt: toEpoch(row.released_at),
    releasedBy: row.released_by,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    windowSeconds: NOTIFICATION_WINDOW_MS / 1000,
  };
}

// Kunin ang kasalukuyang (iisang) row ng notification_state
async function fetchRow(): Promise<StateRow> {
  const { data, error } = await supabaseAdmin
    .from("notification_state")
    .select("*")
    .eq("id", STATE_ROW_ID)
    .single();
  if (error || !data) {
    throw new Error(`[notification-store] Failed to read state: ${error?.message ?? "no data"}`);
  }
  return data as StateRow;
}

// I-update lang ang mga field na binago (partial), ibalik ang buong updated row
async function saveRow(patch: Partial<StateRow>): Promise<StateRow> {
  const { data, error } = await supabaseAdmin
    .from("notification_state")
    .update(patch)
    .eq("id", STATE_ROW_ID)
    .select()
    .single();
  if (error || !data) {
    throw new Error(`[notification-store] Failed to update state: ${error?.message ?? "no data"}`);
  }
  return data as StateRow;
}

// I-log ang buong lifecycle ng isang notification papunta sa history table (audit trail) —
// tinatawag lang tuwing na-resolve na ang isang cycle (acknowledged, released, o expired)
async function logHistory(row: StateRow) {
  const { error } = await supabaseAdmin.from("notification_history").insert({
    notification_sent_at: row.notification_sent_at,
    acknowledged_at: row.acknowledged_at,
    released_at: row.released_at,
    released_by: row.released_by,
    fill_level: row.fill_level,
  });
  if (error) {
    // Hindi natin gustong mag-fail ang buong request dahil lang sa history log —
    // i-log na lang sa console para may makitang paalala kung may mali sa setup
    // eslint-disable-next-line no-console
    console.error("[notification-store] Failed to log history:", error.message);
  }
}

// Tinitingnan tuwing may bumabasa ng state: kung SENT pa rin pero lampas na sa 5 minuto na
// walang acknowledgment, nag-expire na ang notification cycle — at kusang mag-a-activate ang
// actuator (auto-release).
async function applyExpiry(row: StateRow): Promise<StateRow> {
  const sentAt = toEpoch(row.notification_sent_at);

  if (
    row.notification_status === "SENT" &&
    sentAt !== null &&
    Date.now() - sentAt >= NOTIFICATION_WINDOW_MS
  ) {
    const patch: Partial<StateRow> = {
      notification_status: "EXPIRED",
    };

    if (!row.actuator_active && row.release_armed) {
      patch.actuator_active = true;
      patch.release_armed = false;
      patch.released_at = new Date().toISOString();
      patch.released_by = "auto";
    }

    const updated = await saveRow(patch);
    await logHistory(updated);
    return updated;
  }

  return row;
}

// GET /api/notification — kasalukuyang estado, pinapabasa ng dashboard paminsan-minsan
export async function getNotificationState(): Promise<NotificationDto> {
  const row = await applyExpiry(await fetchRow());
  return toDto(row);
}

// Tinatawag tuwing may bagong reading ang ultrasonic sensor (o ang "Simulate" buttons sa
// dashboard habang wala pang totoong hardware). "One FULL event = one notification only".
export async function reportSensorReading(fillLevel: number): Promise<NotificationDto> {
  const current = await applyExpiry(await fetchRow());

  const clamped = Math.max(0, Math.min(100, fillLevel));
  const nextStatus: WasteStatus = clamped >= FULL_THRESHOLD ? "FULL" : "NOT_FULL";

  const patch: Partial<StateRow> = {
    fill_level: clamped,
    waste_status: nextStatus,
  };

  if (clamped < 50 && !current.actuator_active) {
    patch.release_armed = true;
  }

  if (nextStatus === "FULL") {
    if (current.notification_status === "NOT_SENT") {
      // Bagong FULL event lang ang nagpapadala ng bagong notification
      patch.notification_status = "SENT";
      patch.notification_sent_at = new Date().toISOString();
    }
  }

  const updated = await saveRow(patch);
  return toDto(updated);
}

// Pinipindot ng barangay official: "nakita ko na, may pupuntang tao" — hindi na kailangan
// ng actuator, at hindi na dapat magpadala ulit ng notification habang FULL pa rin.
export async function acknowledgeNotification(): Promise<NotificationDto> {
  const current = await applyExpiry(await fetchRow());
  if (current.notification_status === "SENT" && !current.actuator_active) {
    const updated = await saveRow({
      notification_status: "ACKNOWLEDGED",
      acknowledged_at: new Date().toISOString(),
    });
    await logHistory(updated);
    return toDto(updated);
  }
  return toDto(current);
}

export async function releaseNotification(): Promise<NotificationDto> {
  const current = await applyExpiry(await fetchRow());

  if (
    current.fill_level >= 50 &&
    !current.actuator_active &&
    current.release_armed
  ) {
    const patch: Partial<StateRow> = {
      actuator_active: true,
      release_armed: false,
      released_at: new Date().toISOString(),
      released_by: "manual",
    };

    if (current.fill_level >= FULL_THRESHOLD) {
      patch.notification_status = "EXPIRED";
    }

    const updated = await saveRow(patch);
    await logHistory(updated);
    return toDto(updated);
  }

  return toDto(current);
}


export async function completeRelease(): Promise<NotificationDto> {
  const current = await fetchRow();

  if (!current.actuator_active) {
    return toDto(current);
  }

  const nextStatus: WasteStatus =
    current.fill_level >= FULL_THRESHOLD ? "FULL" : "NOT_FULL";

  const updated = await saveRow({
    waste_status: nextStatus,
    notification_status: "NOT_SENT",
    notification_sent_at: null,
    acknowledged_at: null,
    actuator_active: false,
    release_armed: current.fill_level < 50,
    released_at: null,
    released_by: null,
  });

  return toDto(updated);
}