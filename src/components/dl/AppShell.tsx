import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Info,
  LogOut,
  Menu,
  Moon,
  Sun,
  User,
  Waves,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/app-state";
import { currentUser, notifications } from "@/lib/drainlift";
import { StatusPill } from "./primitives";

// AppShell = yung layout na ginagamit ng lahat ng pages: sidebar sa kaliwa, header sa taas,
// at yung page content sa gitna.

// Mga links sa sidebar, naka-group (Main at Info).
// May badge yung Dashboard para ipakita kung ilan ang pending na alerts.
const navGroups = [
  {
    label: "Main",
    items: [
      { to: "/", label: "Dashboard", icon: BarChart3, badge: 1 },
      { to: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Info",
    items: [
      { to: "/about", label: "About Us", icon: Info },
      { to: "/profile", label: "Profile", icon: User },
    ],
  },
] as const;

// Logo at pangalan ng app sa taas ng sidebar
function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
        <Waves className="h-5 w-5" />
      </span>
      <span className="truncate text-xl font-bold tracking-tight">
        <span className="text-primary">Drain</span>
        <span className="text-info">Lift</span>
      </span>
    </div>
  );
}

// Laman ng sidebar. Ginagamit sa desktop (fixed sa gilid) at sa mobile (slide-in menu).
// onNavigate = para maisara yung mobile menu pag may pinindot na link
function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname }); // kasalukuyang URL
  const { theme, toggleTheme, signOut, profile } = useAppState();
  const navigate = useNavigate();
  // Bilangin ang mga alert na pending pa, yun ang lalabas sa badge
  const pending = notifications.filter((n) => n.status === "pending").length;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border">
        <Brand />
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="dl-label px-2 pb-2">{group.label}</p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                // Naka-highlight yung link kung yun ang kasalukuyang page
                const active = pathname === item.to;
                const Icon = item.icon;
                // Badge (pulang bilang) para sa mga item na may "badge" lang
                const badge = "badge" in item && item.badge ? pending : 0;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 h-6 w-0.5 rounded-full bg-primary" />
                      )}
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {badge > 0 && (
                        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-destructive px-1 font-mono text-[11px] text-destructive-foreground">
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Sa baba ng sidebar: theme toggle at user info */}
      <div className="space-y-3 border-t border-sidebar-border p-3">
        {/* Dark / Light mode button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-border-strong bg-secondary px-3 py-2 text-sm text-secondary-foreground transition-colors hover:bg-muted"
        >
          {theme === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
          {theme === "dark" ? "Dark" : "Light"}
        </button>

        {/* User card: initials, pangalan, role, at logout button */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-sidebar-border bg-card px-3 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-info to-primary font-mono text-xs font-bold text-primary-foreground">
            {currentUser.initials}
          </span>
          <Link to="/profile" onClick={onNavigate} className="min-w-0">
            <p className="truncate text-sm font-medium">{profile.name}</p>
            <p className="truncate text-xs text-muted-foreground">{currentUser.role}</p>
          </Link>
          <button
            type="button"
            aria-label="Log out"
            onClick={() => {
              signOut();
              onNavigate?.();
              navigate({ to: "/login" });
            }}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Ginagamit ng bawat page: <AppShell title="..." subtitle="..."> ...content... </AppShell>
// actions = optional na mga button sa kanan ng header
export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false); // bukas ba yung mobile menu
  const { signedIn, demoMode } = useAppState();
  const navigate = useNavigate();

  // Kung hindi naka-sign in, ibalik sa login page
  useEffect(() => {
    if (!signedIn) navigate({ to: "/login" });
  }, [signedIn, navigate]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar sa desktop (nakatago sa maliliit na screen) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border lg:block">
        <SidebarBody />
      </aside>

      {/* Sidebar sa mobile: lalabas lang pag pinindot yung menu button */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Madilim na background, pag pinindot ay magsasara ang menu */}
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-sidebar-border shadow-xl">
            <button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute top-5 right-3 z-10 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarBody onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header sa taas: menu button (mobile), title, at mga action buttons */}
        <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:px-6">
            {/* Menu button, lalabas lang sa mobile */}
            <button
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="rounded-md border border-border-strong p-2 text-muted-foreground lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold sm:text-lg">{title}</h1>
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* "Demo Mode" label, lalabas lang kung demoMode ay true */}
              {demoMode && (
                <StatusPill tone="warning" className="hidden sm:inline-flex">
                  Demo Mode
                </StatusPill>
              )}
              {actions}
            </div>
          </div>
        </header>

        {/* Dito lalabas yung laman ng page */}
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
