import type { ReactNode } from "react";

/** Placeholder provider — app uses dark theme via CSS. Extend when light mode is added. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
