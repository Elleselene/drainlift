import * as React from "react";

// Ilalim ng 768px ang tinuturing na mobile
const MOBILE_BREAKPOINT = 768;

// Hook na nagsasabi kung mobile ang screen (true/false), nag-uupdate pag nag-resize
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // Pakinggan ang pagbabago ng screen width
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    // Cleanup: tanggalin yung listener pag na-unmount ang component
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
