import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Lyra — Shree Agencies Co-Pilot",
    template: "%s · Lyra",
  },
  description:
    "AI Order Co-Pilot for FMCG distributors — live agency portal for Shree Agencies.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">
        <div className="mesh-gradient" aria-hidden="true">
          <div className="mesh-blob-1" />
          <div className="mesh-blob-2" />
        </div>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}