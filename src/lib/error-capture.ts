// Sinasave nito yung original na Error para makuha ng server.ts yung buong details (stack)
// kahit generic 500 Response na lang ang lumabas galing sa h3.

// Huling error na nahuli at kailan ito nangyari
let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000; // 5 seconds lang valid yung nahuling error

// I-save yung error kasama ang oras
function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

// Ang HTTPError ng h3 ay nagiging {"status":500,"unhandled":true,"message":"HTTPError"} lang,
// walang stack at walang cause, kaya kulang ang lumalabas sa console.error.
// Kaya gagawin nating buong string ang error: message, stack, at yung mga "caused by".
const CAUSE_DEPTH_LIMIT = 5;
const DESCRIPTION_LENGTH_LIMIT = 8_000;

// Gawing readable na text ang error (kasama ang mga sanhi nito)
export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < CAUSE_DEPTH_LIMIT && current != null; depth++) {
    if (!(current instanceof Error)) {
      parts.push(typeof current === "string" ? current : safeStringify(current));
      break;
    }
    const label = depth === 0 ? "" : "caused by: ";
    const status = describeStatus(current);
    parts.push(`${label}${current.stack ?? `${current.name}: ${current.message}`}${status}`);
    current = current.cause;
  }
  return parts.join("\n").slice(0, DESCRIPTION_LENGTH_LIMIT);
}

// Kunin ang status code (kung meron) para maisama sa text
function describeStatus(error: Error): string {
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const value = status ?? statusCode;
  return typeof value === "number" ? ` (status ${value})` : "";
}

// JSON.stringify na hindi nagcra-crash (may mga object kasi na hindi kayang i-stringify)
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

// Check kung Error object ba talaga
function isErrorLike(value: unknown): value is Error {
  return value instanceof Error;
}

// Binalot natin yung console.error para lahat ng error na nilo-log (pati galing sa h3)
// ay ma-record at maging buong text bago i-print.
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const expanded = args.map((arg) => {
    if (!isErrorLike(arg)) return arg;
    record(arg);
    return describeError(arg);
  });
  originalConsoleError(...expanded);
};

// Pati yung mga uncaught error at unhandled promise rejection, i-record din
if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

// Kunin yung huling error at burahin na (isang beses lang magagamit).
// Kapag lampas na sa 5 seconds, ituturing na luma na at walang ibabalik.
export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
