"use client";

import { AuthProvider } from "@/lib/AuthProvider";
import { GlobalSearchProvider } from "@/lib/global-search";
import { ThemeProvider } from "@/lib/theme";
import { RequestToastNotifier } from "./components/RequestToastNotifier";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <GlobalSearchProvider>
        <ThemeProvider>
          {children}
          <RequestToastNotifier />
        </ThemeProvider>
      </GlobalSearchProvider>
    </AuthProvider>
  );
}
