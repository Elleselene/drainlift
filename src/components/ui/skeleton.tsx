// shadcn/ui component (galing sa shadcn CLI, standard na component lang ito).
// Skeleton: placeholder na kumikislap habang naglo-load ang data.
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-primary/10", className)} {...props} />;
}

export { Skeleton };
