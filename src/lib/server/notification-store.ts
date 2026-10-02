// Server-only na "backend" para sa DrainLift notification lifecycle — naka-store sa Supabase
// (Postgres), kaya PERMANENTE: hindi nawawala kahit mag-restart o mag-redeploy ang server.
//
// Kailangan munang gawin sa Supabase (SQL editor) ang mga tables na ito bago gumana ang mga
// function sa baba — tingnan ang supabase/schema.sql sa root ng project.
//
// FINAL NOTIFICATION & RELEASE FLOW
//
//   0–49%   -> normal monitoring lang (walang Release / Acknowledge)
//   50–99%  -> may Release Now. Kapag pinindot: Released (naka-log sa history)
//   100%    -> magpapadala ng notification (SENT / LIVE ALERT) + 5-minute countdown,
//              enabled ang Acknowledge Now at Release Now
//   Acknowledge -> ACKNOWLEDGED, hihinto ang countdown (naka-log: Acknowledged)
//   Release     -> RELEASED agad, hihinto ang countdown (naka-log: Released)
//   Walang pinindot sa loob ng 5 minuto -> auto-release (naka-log: Released Automatically)
//   Bumaba ulit sa ibaba ng 50% -> RESET ang buong cycle, ready na ulit
//
// Dahil "**/server/**" ang path nito, bawal itong i-import ng anumang client-side code
// (naka-configure ito sa vite.config.ts, importProtection) — ang route files lang sa ilalim
// ng src/routes/api/ ang dapat gumamit nito.

import { supabaseAdmin } from "./supabase-admin";

const NOTIFICATION_WINDOW_MS = 5 * 60 * 1000; // 5 minuto
const FULL_THRESHOLD = 100; // percent — dito ituturing na "FULL" at magpapadala ng notification
const RELEASE_THRESHOLD = 50; // percent — mula dito pataas, puwede nang mag-Release Now
const STATE_ROW_ID = 1; // iisa lang na row ang notification_state (kasalukuyang buhay na estado)

export type WasteStatus = "FULL" | "NOT_FULL";
// Tandaan: ang "EXPIRED" ay ginagamit para sa LAHAT ng na-release na alert (manual man o auto).
// Ang `releasedBy` ("manual" | "auto") ang nagsasabi kung alin.
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
  // Tumatakbo lang ang countdown habang SENT (LIVE ALERT). Kapag acknowledged, released,
  // o expired na — 0 na agad, para hindi na ito magpatuloy sa dashboard.
  const remainingMs =
    row.notification_status === "SENT" && sentAt
      ? Math.max(0, NOTIFICATION_WINDOW_MS - (Date.now() - sentAt))
      : 0;
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

// Conditional update: gagana lang kung pasok pa rin ang row sa `guard` (hal. status ay SENT pa).
// Ito ang pumipigil na magka-DOUBLE ang history log kapag sabay ang dalawang request
// (hal. double-click sa button, o dalawang tabs/poll na sabay nag-expire ng notification).
// Ibinabalik ang updated row, o null kung may naunang request na nag-update na.
async function updateIf(
  patch: Partial<StateRow>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  guard: (query: any) => any,
): Promise<StateRow | null> {
  const base = supabaseAdmin.from("notification_state").update(patch).eq("id", STATE_ROW_ID);
  const { data, error } = await guard(base).select().maybeSingle();
  if (error) {
    throw new Error(`[notification-store] Failed to update state: ${error.message}`);
  }
  return (data as StateRow | null) ?? null;
}

// I-log ang buong lifecycle ng isang notification papunta sa history table (audit trail) —
// tinatawag lang tuwing na-resolve na ang isang cycle (acknowledged, released, o auto-released)
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

// Tinitingnan tuwing may bumabasa/nagsusulat ng state: kung SENT pa rin pero lampas na sa
// 5 minuto na walang acknowledge/release, kusang mag-a-auto-release (Released Automatically).
// Hindi na ito nakadepende sa fill level — kapag SENT na ang notification, tuloy ang cycle
// hanggang ma-resolve.
async function applyExpiry(row: StateRow): Promise<StateRow> {
  const sentAt = toEpoch(row.notification_sent_at);

  if (
    row.notification_status === "SENT" &&
    sentAt !== null &&
    Date.now() - sentAt >= NOTIFICATION_WINDOW_MS
  ) {
    const updated = await updateIf(
      {
        notification_status: "EXPIRED",
        released_at: new Date().toISOString(),
        released_by: "auto",
        release_armed: false,
      },
      (q) => q.eq("notification_status", "SENT"),
    );

    // Null = may ibang request na nag-expire/nag-resolve na nito; kunin lang ang pinakabago
    if (!updated) return fetchRow();

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

  // Huwag tanggapin ang sirang reading (NaN, undefined, atbp.)
  if (!Number.isFinite(fillLevel)) return toDto(current);

  const clamped = Math.max(0, Math.min(100, Math.round(fillLevel)));
  const nextStatus: WasteStatus = clamped >= FULL_THRESHOLD ? "FULL" : "NOT_FULL";

  const basePatch: Partial<StateRow> = {
    fill_level: clamped,
    waste_status: nextStatus,
  };

  // BUMABA SA IBABA NG 50% -> RESET ang buong cycle (clear ang Released/Acknowledged,
  // ready na ulit para sa panibagong cycle)
  if (clamped < RELEASE_THRESHOLD) {
    return toDto(
      await saveRow({
        ...basePatch,
        notification_status: "NOT_SENT",
        notification_sent_at: null,
        acknowledged_at: null,
        released_at: null,
        released_by: null,
        release_armed: true,
      }),
    );
  }

  // 100% AT WALA PANG NOTIFICATION SA CYCLE NA ITO -> magpadala ng bago (LIVE ALERT)
  if (clamped >= FULL_THRESHOLD && current.notification_status === "NOT_SENT") {
    const updated = await updateIf(
      {
        ...basePatch,
        notification_status: "SENT",
        notification_sent_at: new Date().toISOString(),
        // Linisin ang anumang naunang manual release (hal. na-release sa 70% pero tumaas ulit
        // sa 100%) para hindi agad "Released" ang bagong alert
        acknowledged_at: null,
        released_at: null,
        released_by: null,
        release_armed: true,
      },
      (q) => q.eq("notification_status", "NOT_SENT"),
    );
    if (updated) return toDto(updated);
    // Kung null: may kasabay na reading na nakapagpadala na ng notification — fill level lang ang i-update
  }

  // 50–99% (o 100% na may aktibo/na-resolve nang notification): fill level lang ang gumagalaw.
  // "FULL pa rin" ay hindi nagpapadala ng bagong notification.
  return toDto(await saveRow(basePatch));
}

// Pinipindot ng barangay official: "nakita ko na, may pupuntang tao" — hihinto ang countdown
// at hindi na magpapadala ulit ng notification habang FULL pa rin. Release Now pa rin ang
// kailangan para sa totoong release.
export async function acknowledgeNotification(): Promise<NotificationDto> {
  const current = await applyExpiry(await fetchRow());

  // Puwede lang mag-acknowledge habang LIVE ALERT (SENT) pa
  if (current.notification_status !== "SENT") return toDto(current);

  const updated = await updateIf(
    {
      notification_status: "ACKNOWLEDGED",
      acknowledged_at: new Date().toISOString(),
    },
    (q) => q.eq("notification_status", "SENT"),
  );

  // Null = may naunang request (hal. double-click o auto-release) — ibalik na lang ang kasalukuyan
  if (!updated) return toDto(await fetchRow());

  await logHistory(updated);
  return toDto(updated);
}

// "Release Now" — puwede mula 50% pataas (kasama ang 50–99% na walang notification, at
// 100% na SENT o ACKNOWLEDGED). Isang beses lang bawat cycle: kapag released na, hindi na
// ito mauulit hanggang bumaba ulit sa ibaba ng 50%.
export async function releaseNotification(): Promise<NotificationDto> {
  const current = await applyExpiry(await fetchRow());

  // Walang Release sa 0–49%, at bawal ang ikalawang release sa parehong cycle
  if (current.fill_level < RELEASE_THRESHOLD || current.released_at !== null) {
    return toDto(current);
  }

  const patch: Partial<StateRow> = {
    released_at: new Date().toISOString(),
    released_by: "manual",
    release_armed: false,
  };

  // Kung may aktibong alert (LIVE o Acknowledged), tapos na ito — hihinto ang countdown
  if (
    current.notification_status === "SENT" ||
    current.notification_status === "ACKNOWLEDGED"
  ) {
    patch.notification_status = "EXPIRED";
  }

  const updated = await updateIf(patch, (q) => q.is("released_at", null));
  if (!updated) return toDto(await fetchRow()); // may naunang release na

  await logHistory(updated);
  return toDto(updated);
}

// LEGACY: wala nang actuator control sa website — ang arduino_controller.py na ang may hawak
// ng actuator command. Iniwan lang ang function na ito para hindi mag-break ang anumang route
// na nag-i-import pa rin nito; walang binabago sa estado. Puwede mo na itong burahin kasama
// ng route na tumatawag dito.
export async function completeRelease(): Promise<NotificationDto> {
  return toDto(await fetchRow());
}
