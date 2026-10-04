/**
 * DrainLift demo data + helper functions.
 *
 * Lahat ng data dito ay SIMULATED lang (dummy) kasi hindi pa nakakabit
 * yung Raspberry Pi / Arduino unit. Pag connected na yung backend, papalitan
 * na lang natin ito ng API calls. Yung mga "type" sa baba ay sinusundan yung
 * magiging tables sa database.
 */

// Mga possible na estado ng waste compartment depende sa fill level
export type FillState = "normal" | "warning" | "critical" | "full";

// Gawing state yung fill level (percent):
// 100 = full, 90+ = critical, 70+ = warning, kulang doon = normal
export function fillState(level: number): FillState {
  if (level >= 100) return "full";
  if (level >= 90) return "critical";
  if (level >= 70) return "warning";
  return "normal";
}

// Text na ipapakita sa UI para sa bawat state
export const fillStateLabel: Record<FillState, string> = {
  normal: "Normal",
  warning: "Warning",
  critical: "Critical",
  full: "Full",
};

// Details ng DrainLift unit na naka-install sa canal
export type Device = {
  deviceNumber: string;
  owner: string;
  location: string;
  installationDate: string;
  status: "online" | "offline";
};

// Dummy device data (isang unit lang muna for now)
export const device: Device = {
  deviceNumber: "DL-2026-001",
  owner: "Brgy. Tanza",
  location: "Tanza, Boac",
  installationDate: "2026-01-15",
  status: "online",
};

// Dummy na naka-login na user (admin ng barangay)
export const currentUser = {
  name: "Juan Dela Cruz",
  initials: "JDC",
  handle: "@Brgy. Kagawad",
  role: "Facility Admin",
  email: "admin@drainlift.com",
  phone: "+63 9770368280",
};

// Status ng bawat hardware/software part ng system
export type SubsystemStatus = {
  name: string;
  state: "online" | "offline" | "degraded";
  detail: string;
};

// Listahan ng mga subsystem (Pi, Arduino, camera, sensor, database)
export const subsystems: SubsystemStatus[] = [
  { name: "Raspberry Pi 5", state: "online", detail: "Heartbeat 4s ago" },
  { name: "Arduino Uno", state: "online", detail: "Serial link stable" },
  { name: "Pi Camera", state: "online", detail: "Snapshot mode" },
  { name: "Ultrasonic Sensor", state: "online", detail: "Reading 12.4 cm" },
  { name: "Database", state: "online", detail: "Simulated store" },
];

// Paalala: ang totoong notification history (audit log) ay galing na sa Supabase —
// tingnan ang src/lib/server/notification-store.ts at GET /api/notification-history.
// Dating may dummy na "notifications" array dito, tinanggal na dahil live data na ang
// ginagamit ng "/notifications" page at ng preview sa Dashboard.

// Result ng AI garbage detection (uri ng basura, ilan, at gaano ka-sure)
export type Detection = {
  type: string;
  count: number;
  confidence: number;
};

// Sample na detections mula sa camera
export const detections: Detection[] = [
  { type: "Plastic", count: 4, confidence: 0.94 },
  { type: "Bottle", count: 2, confidence: 0.89 },
  { type: "Other", count: 1, confidence: 0.71 },
];

// Fill level kada oras (pang-chart sana ng pagtaas ng basura)
export const fillHistory = [
  { time: "08:00", fill: 22 },
  { time: "09:00", fill: 35 },
  { time: "10:00", fill: 48 },
  { time: "11:00", fill: 61 },
  { time: "12:00", fill: 78 },
  { time: "13:00", fill: 88 },
  { time: "14:00", fill: 94 },
  { time: "15:00", fill: 100 },
];

// Log ng mga collection: kailan nagsimula/natapos at sino ang nag-handle
export const collectionEvents = [
  {
    id: "c1",
    startedAt: "2026-08-12 12:50",
    completedAt: "2026-08-12 12:58",
    status: "Completed",
    operator: "Juan Dela Cruz",
    notes: "Manual acknowledgment, conveyor run 8 min",
  },
  {
    id: "c2",
    startedAt: "2026-08-12 12:31",
    completedAt: "2026-08-12 12:37",
    status: "Auto-Released",
    operator: "System",
    notes: "No acknowledgment within 5 minutes",
  },
  {
    id: "c3",
    startedAt: "2026-08-11 17:04",
    completedAt: "2026-08-11 17:12",
    status: "Completed",
    operator: "Kagawad Reyes",
    notes: "Routine collection",
  },
];

/**
 * Researchers — placeholder pa lang ang mga entries. Palitan ng totoong
 * pangalan, role at photo URL. Kung ano ang nakalista dito, yun ang
 * lalabas sa About page.
 */
export type Researcher = { name: string; role: string; photo?: string };

export const researchers = [
  {
    name: "Carla Joy S. Moje",
    role: "Hardware & Sensor Integration",
    photo: "/carla.png",
  },
  {
    name: "Kate Marie Faye M. Manuba",
    role: "Image Detection & System Design",
    photo: "/kate.png",
  },
  {
    name: "Jaynabelle C. Rioflorido",
    role: "Web Application & Database Development",
    photo: "/jaynabelle.png",
  },
  {
    name: "Chad Michael M. Jantoc",
    role: "Prototype Development & Fabrication",
    photo: "/chad.png",
  },
];

// Kunin ang initials ng pangalan, hal. "Juan Dela Cruz" -> "JD"
// (first letter ng unang dalawang salita)
export function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
