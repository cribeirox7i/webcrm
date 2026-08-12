import { createContext, useContext, useEffect } from "react";

export const PageTitleContext = createContext<(title: string | null) => void>(() => {});

/** Define o título exibido na primeira linha da página (topbar) enquanto o componente
 * chamador estiver montado; volta ao título padrão da aba ao desmontar. */
export function usePageTitle(items: (string | number)[]) {
  const setTitle = useContext(PageTitleContext);
  const title = items.join(" » ");

  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
}
