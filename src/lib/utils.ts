import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper para pagsamahin ang mga className.
// clsx = para sa conditional classes, twMerge = para hindi mag-conflict ang Tailwind classes
// (halimbawa: pag may "p-2" at "p-4", yung huli lang ang mananalo)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
