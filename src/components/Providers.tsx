"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { useEffect } from "react";
import { Toaster } from "sonner";

// Browser chrome color follows the resolved theme, including a manual override
// that the <meta media> fallbacks in layout.tsx can't see.
const THEME_COLOR = { light: "#F4EFE4", dark: "#0F131A" } as const;

function ThemeChrome() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => {
        meta.content = THEME_COLOR[resolvedTheme];
        meta.removeAttribute("media");
      });
  }, [resolvedTheme]);

  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-left"
      visibleToasts={3}
      offset={24}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <ThemeChrome />
    </ThemeProvider>
  );
}
