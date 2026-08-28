"use client";

import type { ReactNode } from "react";
import { Navigation } from "./nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-50 lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 z-20 flex flex-col bg-zinc-900 text-zinc-100 lg:min-h-dvh lg:h-dvh">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white">
            Ly
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">Lyra</p>
            <p className="text-[11px] text-zinc-400">Shree Agencies · Co-Pilot</p>
          </div>
        </div>
        <Navigation />
        <div className="hidden border-t border-zinc-800 px-4 py-4 lg:block">
          <p className="text-[11px] leading-relaxed text-zinc-500">
            AI Order Co-Pilot for FMCG distributors.
            <br />
            Live demo · data from Supabase
          </p>
        </div>
      </aside>
      <main className="min-w-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
