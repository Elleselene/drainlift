import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

// Middleware na sumasalo ng errors sa server. Kung may pumalpak, error page ang ibabalik
// imbes na masira o mag-crash ang buong site.
const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Kung may statusCode na (hal. redirect o 404), hayaan lang, hindi ito totoong crash
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Proteksyon laban sa CSRF (cross-site requests) para sa server functions.
// Kusa itong nilalagay ng TanStack Start kung walang start.ts, pero dahil may sarili
// na tayong start.ts, kailangan natin siyang ilagay manually.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Ilagay yung dalawang middleware sa lahat ng requests
export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
