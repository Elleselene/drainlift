import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Mga maliliit na reusable components ng DrainLift (Card, StatusPill, Button, etc.)
// para pareho ang itsura ng lahat ng pages.

// Basic na kahon na may border. Pag accent={true}, may gradient line sa taas
export function Card({
  className,
  children,
  accent = false,
}: {
  className?: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-[0_1px_0_0_var(--color-border)]",
        accent && "dl-accent-top",
        className,
      )}
    >
      {children}
    </div>
  );
}

// Title ng section na may maliit na green bar sa kaliwa
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
      <span className="h-4 w-1 rounded-full bg-primary" />
      {children}
    </h2>
  );
}

// Mga pwedeng kulay: green (primary), blue (info), yellow (warning), red (danger), gray (muted)
type Tone = "primary" | "info" | "warning" | "danger" | "muted";

// Tailwind classes para sa bawat kulay
const toneClasses: Record<Tone, string> = {
  primary: "border-primary/40 bg-primary/10 text-primary",
  info: "border-info/40 bg-info/10 text-info",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border-strong bg-muted text-muted-foreground",
};

// Maliit na bilog na label para sa status (hal. "Acknowledged", "Auto-Released").
// dot = kung may maliit na tuldok sa unahan
export function StatusPill({
  tone = "primary",
  children,
  dot = true,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] tracking-wider uppercase",
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// Card na may label sa taas at value sa baba (hal. Owner, Location), may optional na icon
export function InfoCard({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card accent className={cn("p-4", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="dl-label">{label}</p>
          <p className="mt-1 truncate font-mono text-lg font-semibold text-foreground">
            {value}
          </p>
        </div>
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      </div>
    </Card>
  );
}

// Card para sa numbers/statistics (hal. bilang ng notifications) na may icon sa kaliwa
export function StatCard({
  value,
  label,
  icon,
  tone = "info",
}: {
  value: ReactNode;
  label: string;
  icon: ReactNode;
  tone?: Tone;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-lg border",
            toneClasses[tone],
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-mono text-2xl leading-none font-bold text-foreground">{value}</p>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

// Sarili nating Button component. May variants: default, primary, info, danger, ghost
export function Button({
  children,
  onClick,
  variant = "default",
  className,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost" | "info";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  // Classes para sa bawat variant ng button
  const variants: Record<string, string> = {
    default: "border-border-strong bg-secondary text-secondary-foreground hover:bg-muted",
    primary: "border-primary/50 bg-primary/15 text-primary hover:bg-primary/25",
    info: "border-info/50 bg-info/15 text-info hover:bg-info/25",
    danger:
      "border-destructive/50 bg-destructive/15 text-destructive hover:bg-destructive/25",
    ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-muted",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

// Progress bar ng fill level. Red kapag 90%+, yellow kapag 70%+, green kung kulang doon
export function FillBar({ level, className }: { level: number; className?: string }) {
  // Pumili ng kulay depende sa level
  const tone =
    level >= 90 ? "bg-destructive" : level >= 70 ? "bg-warning" : "bg-primary";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-700", tone)}
        // Sinisiguradong nasa pagitan ng 0 at 100 lang ang width
        style={{ width: `${Math.min(100, Math.max(0, level))}%` }}
      />
    </div>
  );
}
