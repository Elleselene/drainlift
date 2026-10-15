export type WasteStatus = "FULL" | "NOT_FULL";

export type NotificationStatus = "NOT_SENT" | "SENT" | "ACKNOWLEDGED" | "RELEASED";

export type ReleasedBy = "manual" | "auto" | null;

export type NotificationDto = {
  wasteStatus: WasteStatus;
  fillLevel: number;
  actualFillLevel: number | null;
  notificationStatus: NotificationStatus;
  notificationSentAt: number | null;
  acknowledgedAt: number | null;
  releasedAt: number | null;
  releasedBy: ReleasedBy;
  resetAt: number | null;
  remainingMs: number;
  remainingSeconds: number;
  resetRemainingMs: number;
  windowSeconds: number;
  resetSeconds: number;
  releaseArmed: boolean;
  fullOverrideActive: boolean;
  serverTime: number;
};
