import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppStateProvider } from "@/lib/app-state";
import { Toaster } from "@/components/ui/sonner";

// Root route: ito yung pinaka-balot ng lahat ng pages (layout, meta tags, error pages).

// 404 page: lalabas pag walang page na tumutugma sa URL
function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

// Error page: lalabas pag may nag-crash na component o loader sa loob ng app
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error); // i-log sa console para makita natin kung anong error
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {/* "Try again": i-refresh ang data ng router tapos i-reset yung error */}
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

// Definition ng root route. May "queryClient" sa context para magamit ng lahat ng routes.
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // head = laman ng <head>: title, meta tags (SEO / social share preview), fonts at CSS
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0f172a" },
      { title: "DrainLift — Smart Drainage Monitoring" },
      {
        name: "description",
        content:
          "DrainLift monitors barangay drainage canals in real time and collects floating garbage automatically.",
      },
      { name: "author", content: "DrainLift" },
      { property: "og:title", content: "DrainLift — Smart Drainage Monitoring" },
      {
        property: "og:description",
        content: "Real-time canal waste monitoring for barangay drainage units.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      // Global styles natin (Tailwind + colors)
       {
        rel: "manifest",
        href: "/manifest.webmanifest",
      },

      {
        
        rel: "stylesheet",
        href: appCss,
      },
      // Google Fonts: Space Grotesk (text) at JetBrains Mono (numbers/labels)
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell, // ang <html> at <body> na balot ng lahat
  component: RootComponent, // providers + <Outlet />
  notFoundComponent: NotFoundComponent, // 404
  errorComponent: ErrorComponent, // error page
});

// HTML shell ng page. Naka-"dark" class na agad para dark ang default na theme.
function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {/* Scripts ng TanStack Start (para gumana ang app sa browser) */}
        <Scripts />
      </body>
    </html>
  );
}

// Bumabalot sa lahat ng pages ng React Query at ng app state (theme, login, profile)
function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AppStateProvider>
        {/* Dito lalabas yung kasalukuyang page. Huwag tanggalin kasi walang lalabas na page pag nawala ito */}
        <Outlet />
        {/* Toast notifications (hal. pag na-auto-release na ang actuator) */}
        <Toaster position="top-right" theme="dark" richColors />
      </AppStateProvider>
    </QueryClientProvider>
  );
}
