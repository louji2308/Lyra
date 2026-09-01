"use client";

import type { ReactNode } from "react";
import { TopNav } from "./top-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <TopNav />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-6xl px-4 pt-24 pb-12 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}