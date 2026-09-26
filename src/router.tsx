import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Dito ginagawa ang router ng buong app (tinatawag ng TanStack Start sa server at sa browser)
export const getRouter = () => {
  // React Query client, para sa data fetching/caching (pwede na natin gamitin pag may API na)
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree, // listahan ng lahat ng pages (auto-generated sa routeTree.gen.ts)
    context: { queryClient }, // maa-access ng lahat ng routes
    scrollRestoration: true, // ibabalik sa dating scroll position pag nag-back
    defaultPreloadStaleTime: 0, // laging fresh ang preloaded na data
  });

  return router;
};
