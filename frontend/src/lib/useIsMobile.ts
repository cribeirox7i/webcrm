import { useEffect, useState } from "react";

// Mesmo breakpoint que já bloqueava o app inteiro em telas estreitas (ver leva de 2026-08-12,
// "Bloqueio de acesso mobile") -- agora usado pra decidir layout responsivo em vez de só
// esconder tudo. `matchMedia` (não `window.innerWidth` num listener de resize) porque dispara
// só quando cruza o breakpoint, não em todo pixel de resize -- menos re-render.
const BREAKPOINT = "(max-width: 767px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(BREAKPOINT).matches);

  useEffect(() => {
    const mql = window.matchMedia(BREAKPOINT);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
