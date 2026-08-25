import { useIsMobile } from "../lib/useIsMobile";

/** Bloqueia telas inteiras que ainda não têm layout mobile -- Admin (`/admin`) e Definir Senha
 * (`/definir-senha`). Substitui o antigo `#mobile-block` estático em `index.html`/`index.css`
 * (leva "Bloqueio de acesso mobile", 2026-08-12): mesmo aviso, mesmo comportamento, mas agora
 * dentro do React (via `useIsMobile`) em vez de CSS fora da árvore -- necessário pra poder
 * liberar só o app principal (`App.tsx`) por tela, em vez de tudo ou nada. */
export function MobileOnlyGate({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <div className="mobile-gate">
        <p>Esta tela foi desenvolvida para uso em computador.</p>
        <p>Acesse por um desktop ou notebook.</p>
      </div>
    );
  }
  return <>{children}</>;
}
