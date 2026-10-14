import { supabaseAdmin } from "./supabase-admin";



const NOTIFICATION_WINDOW_MS = 5 * 60 * 1000;

const RELEASE_TIMEOUT_MS = 2 * 60 * 1000;

const HEARTBEAT_TIMEOUT_MS = 20 * 1000;

const FULL_THRESHOLD = 100;

const RESET_THRESHOLD = 50;

const STATE_ROW_ID = 1;



export type WasteStatus = "FULL" | "NOT_FULL";

export type NotificationStatus = "NOT_SENT" | "SENT" | "ACKNOWLEDGED" | "EXPIRED";

export type ReleasedBy = "manual" | "auto" | null;



type StateRow = {

  id: number;

  waste_status: WasteStatus;

  fill_level: number;

  notification_status: NotificationStatus;

  notification_sent_at: string | null;

  acknowledged_at: string | null;

  release_armed: boolean;

  released_at: string | null;

  released_by: ReleasedBy;

  full_override_active: boolean;

  actual_fill_level: number | null;

  hardware_system_active: boolean | null;

  hardware_last_seen_at: string | null;

};



export type NotificationDto = {

  wasteStatus: WasteStatus;

  fillLevel: number;

  notificationStatus: NotificationStatus;

  notificationSentAt: number | null;

  acknowledgedAt: number | null;

  releasedAt: number | null;

  releasedBy: ReleasedBy;

  remainingSeconds: number;

  windowSeconds: number;

  actuatorActive: boolean;

  releaseArmed: boolean;

  fullOverrideActive: boolean;

  hardwareSystemActive: boolean | null;

  hardwareOnline: boolean;

};



function toEpoch(iso: string | null): number | null {

  return iso ? new Date(iso).getTime() : null;

}



function toDto(row: StateRow): NotificationDto {

  const sentAt = toEpoch(row.notification_sent_at);

  const remainingMs =

    row.notification_status === "SENT" && sentAt !== null

      ? Math.max(0, NOTIFICATION_WINDOW_MS - (Date.now() - sentAt))

      : 0;



  return {

    wasteStatus: row.waste_status,

    fillLevel: row.fill_level,

    notificationStatus: row.notification_status,

    notificationSentAt: sentAt,

    acknowledgedAt: toEpoch(row.acknowledged_at),

    releasedAt: toEpoch(row.released_at),

    releasedBy: row.released_by,

    remainingSeconds: Math.ceil(remainingMs / 1000),

    windowSeconds: NOTIFICATION_WINDOW_MS / 1000,

    actuatorActive: row.released_at !== null,

    releaseArmed: row.release_armed,

    fullOverrideActive: row.full_override_active,

    hardwareSystemActive: row.hardware_system_active,

    hardwareOnline: isOnline(row),

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



async function updateIf(

  patch: Partial<StateRow>,

  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  guard: (query: any) => any,

): Promise<StateRow | null> {

  const query = supabaseAdmin

    .from("notification_state")

    .update(patch)

    .eq("id", STATE_ROW_ID);

  const { data, error } = await guard(query).select().maybeSingle();



  if (error) {

    throw new Error(`[notification-store] Conditional update failed: ${error.message}`);

  }



  return (data as StateRow | null) ?? null;

}



async function logHistory(row: StateRow): Promise<void> {

  const { error } = await supabaseAdmin.from("notification_history").insert({

    notification_sent_at: row.notification_sent_at,

    acknowledged_at: row.acknowledged_at,

    released_at: row.released_at,

    released_by: row.released_by,

    fill_level: row.fill_level,

  });



  if (error) {

    console.error("[notification-store] History insert failed:", error.message);

  }

}



function isOnline(row: StateRow): boolean {

  const seen = toEpoch(row.hardware_last_seen_at);

  return seen !== null && Date.now() - seen < HEARTBEAT_TIMEOUT_MS;

}



// This resets WEBSITE state only. The Arduino controls physical movement.

// Disarm the cycle until fill falls below 50%, avoiding a repeat at 100%.

const normalPatch: Partial<StateRow> = {

  notification_status: "NOT_SENT",

  notification_sent_at: null,

  acknowledged_at: null,

  released_at: null,

  released_by: null,

  release_armed: false,

};



async function normalizeWebsiteState(row: StateRow): Promise<StateRow> {
  // A lost heartbeat invalidates undelivered release requests, not the UI alert.
  // The Arduino must independently guard against stale or duplicate commands.
  if (!isOnline(row) || row.hardware_system_active === false) {
    if (row.released_at !== null) {
      const updated = await updateIf(
        { ...normalPatch, hardware_system_active: isOnline(row) ? false : null },
        (q) => q.eq("released_at", row.released_at),
      );
      return updated ?? fetchRow();
    }
    return row;
  }

  const releasedAt = toEpoch(row.released_at);
  if (releasedAt !== null && Date.now() - releasedAt >= RELEASE_TIMEOUT_MS) {
    const updated = await updateIf(normalPatch, (q) => q.eq("released_at", row.released_at));
    return updated ?? fetchRow();
  }
  return row;
}

async function applyExpiry(row: StateRow): Promise<StateRow> {

  row = await normalizeWebsiteState(row);

  const sentAt = toEpoch(row.notification_sent_at);

  // Offline expiry closes the alert without creating a physical release command.
  if (row.notification_status === "SENT" && sentAt !== null &&
      Date.now() - sentAt >= NOTIFICATION_WINDOW_MS &&
      (!isOnline(row) || row.hardware_system_active !== true)) {
    const updated = await updateIf(
      { notification_status: "EXPIRED", release_armed: false },
      (q) => q.eq("notification_status", "SENT").is("released_at", null),
    );
    return updated ?? fetchRow();
  }




  if (

    row.hardware_system_active !== true ||

    !isOnline(row) ||

    row.notification_status !== "SENT" ||

    sentAt === null ||

    Date.now() - sentAt < NOTIFICATION_WINDOW_MS

  ) {

    return row;

  }



  const updated = await updateIf(

    {

      notification_status: "EXPIRED",

      released_at: new Date().toISOString(),

      released_by: "auto",

      release_armed: false,

    },

    (q) => q.eq("hardware_system_active", true).eq("notification_status", "SENT").is("released_at", null),

  );



  if (!updated) return fetchRow();

  await logHistory(updated);

  return updated;

}



export async function getNotificationState(): Promise<NotificationDto> {

  return toDto(await applyExpiry(await fetchRow()));

}



function normalizedLevel(fillLevel: number): number {

  if (!Number.isFinite(fillLevel) || fillLevel < 0 || fillLevel > 100) {

    throw new Error("Fill level must be a number from 0 to 100.");

  }

  return Math.round(fillLevel);

}



async function processEffectiveFill(

  level: number,

  options: { actualSensor: boolean },

): Promise<NotificationDto> {

  const current = await applyExpiry(await fetchRow());

  const clamped = normalizedLevel(level);



  if (options.actualSensor && current.full_override_active) {

    const { error } = await supabaseAdmin

      .from("notification_state")

      .update({ actual_fill_level: clamped })

      .eq("id", STATE_ROW_ID);

    if (error) throw new Error(`[notification-store] Sensor reading failed: ${error.message}`);

    return toDto(current);

  }



  const basePatch: Partial<StateRow> = {

    fill_level: clamped,

    waste_status: clamped === FULL_THRESHOLD ? "FULL" : "NOT_FULL",

    ...(options.actualSensor ? { actual_fill_level: clamped } : {}),

  };



  // UI alerts are based on the effective fill level, even in Bypass mode
  // when the Raspberry Pi is offline. Hardware release remains guarded
  // separately by releaseNotification() and applyExpiry().



  // Re-arm only after the measured fill drops below 50%.

  // Never erase a pending hardware release request.

  if (clamped < RESET_THRESHOLD) {

    if (current.released_at !== null) {

      return toDto(await saveRow(basePatch));

    }

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



  if (clamped === FULL_THRESHOLD && current.notification_status === "NOT_SENT" && current.released_at === null && current.release_armed) {

    const updated = await updateIf(

      {

        ...basePatch,

        notification_status: "SENT",

        notification_sent_at: new Date().toISOString(),

        acknowledged_at: null,

        released_at: null,

        released_by: null,

        release_armed: true,

      },

      (q) => q.eq("notification_status", "NOT_SENT").eq("release_armed", true).is("released_at", null),

    );

    if (updated) return toDto(updated);

  }



  return toDto(await saveRow(basePatch));

}



export async function reportSensorReading(fillLevel: number): Promise<NotificationDto> {

  return processEffectiveFill(fillLevel, { actualSensor: true });

}



// Call this from the admin-only Carla slider endpoint (not from sensor-reading).

export async function setCarlaFillLevel(fillLevel: number): Promise<NotificationDto> {

  const level = normalizedLevel(fillLevel);

  const current = await applyExpiry(await fetchRow());

  if (!current.full_override_active) {

    throw new Error("Turn Bypass ON using the clock icon before using Carla's slider.");

  }

  if (current.released_at !== null) {

    throw new Error("Wait for the current hardware release to finish.");

  }

  return processEffectiveFill(level, { actualSensor: false });

}



export async function setBypassEnabled(enabled: boolean): Promise<NotificationDto> {

  const current = await applyExpiry(await fetchRow());

  if (current.full_override_active === enabled) return toDto(current);

  if (current.released_at !== null) {

    throw new Error("Cannot switch Bypass Mode during a pending hardware release.");

  }

  if (enabled) {

    const updated = await updateIf(

      {

        full_override_active: true,

        actual_fill_level: current.actual_fill_level ?? current.fill_level,

      },

      (q) => q.eq("full_override_active", false).is("released_at", null),

    );

    return toDto(updated ?? (await fetchRow()));

  }

  const actual = current.actual_fill_level ?? current.fill_level;

  const updated = await updateIf(

    { full_override_active: false },

    (q) => q.eq("full_override_active", true).is("released_at", null),

  );

  if (!updated) return toDto(await fetchRow());

  return processEffectiveFill(actual, { actualSensor: true });

}



export async function acknowledgeNotification(): Promise<NotificationDto> {

  const current = await applyExpiry(await fetchRow());

  if (current.notification_status !== "SENT" || current.fill_level !== FULL_THRESHOLD) return toDto(current);



  const updated = await updateIf(

    {

      notification_status: "ACKNOWLEDGED",

      acknowledged_at: new Date().toISOString(),

    },

    (q) => q.eq("notification_status", "SENT").eq("fill_level", FULL_THRESHOLD).is("released_at", null),

  );



  if (!updated) return toDto(await fetchRow());

  await logHistory(updated);

  return toDto(updated);

}



export async function releaseNotification(): Promise<NotificationDto> {

  const current = await applyExpiry(await fetchRow());

  // A stopped device can accept a UI click, but never creates a release command.

  if (current.hardware_system_active !== true || !isOnline(current)) {

    return cancelStoppedRelease();

  }



  if (

    current.fill_level !== FULL_THRESHOLD ||

    current.released_at !== null ||

    (current.notification_status !== "SENT" &&

      current.notification_status !== "ACKNOWLEDGED")

  ) {

    return toDto(current);

  }



  const updated = await updateIf(

    {

      notification_status: "EXPIRED",

      released_at: new Date().toISOString(),

      released_by: "manual",

      release_armed: false,

    },

    (q) =>

      q.eq("hardware_system_active", true)

        .is("released_at", null)

        .eq("fill_level", FULL_THRESHOLD)

        .in("notification_status", ["SENT", "ACKNOWLEDGED"]),

  );



  if (!updated) return toDto(await fetchRow());

  await logHistory(updated);

  return toDto(updated);

}



// Compatibility with older callers; bypass activation is controlled by the clock only.

export async function activateFullOverride(): Promise<NotificationDto> {

  return setBypassEnabled(true);

}



export async function clearFullOverride(): Promise<NotificationDto> {

  return setBypassEnabled(false);

}



export async function cancelStoppedRelease(): Promise<NotificationDto> {

  const row = await fetchRow();

  if (row.hardware_system_active === true && isOnline(row)) return toDto(row);

  // Cancel only an undelivered pending release. Keep the FULL alert
  // available for acknowledgement even while the device is offline.
  if (row.released_at === null) return toDto(row);
  const updated = await updateIf(normalPatch, (q) => q.eq("released_at", row.released_at));
  return toDto(updated ?? (await fetchRow()));

}



// Authenticated Pi heartbeat. OFF is confirmed by Arduino; missing heartbeat is OFFLINE.

export async function reportHardwareStatus(active: boolean): Promise<NotificationDto> {

  const current = await fetchRow();

  const now = new Date().toISOString();

  if (!active) {

    const updated = await saveRow({

      ...(current.released_at !== null ? normalPatch : {}),

      hardware_system_active: false,

      hardware_last_seen_at: now,

    });

    return toDto(updated);

  }

  const wasOnline = isOnline(current) && current.hardware_system_active === true;

  // A reconnect must never re-arm a previously cancelled command.

  const updated = await saveRow({

    ...(!wasOnline && current.released_at !== null ? normalPatch : {}),

    hardware_system_active: true,

    hardware_last_seen_at: now,

  });

  return toDto(updated);

}
