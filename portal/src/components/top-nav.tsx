"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

export const navGroups = [
  {
    key: "shops",
    label: "Shops",
    items: [
      { href: "/shops", label: "All Shops" },
      { href: "/shops/credit", label: "Credit & Payments" },
      { href: "/shops/blacklist", label: "Blacklist" },
      { href: "/shops/memory", label: "AI Memory" },
    ],
  },
  {
    key: "orders",
    label: "Orders",
    items: [
      { href: "/orders", label: "All Orders" },
      { href: "/orders/create", label: "Create Order" },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    items: [
      { href: "/deliveries", label: "Deliveries" },
      { href: "/admin/routes", label: "Routes" },
      { href: "/payments", label: "Payments" },
      { href: "/exceptions", label: "Exceptions" },
    ],
  },
  {
    key: "catalog",
    label: "Catalog",
    items: [
      { href: "/catalog", label: "Products" },
      { href: "/catalog/inventory", label: "Inventory" },
      { href: "/admin/schemes", label: "Schemes" },
    ],
  },
];

function NavLink({ href, label, isActive }: { href: string; label: string; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={`nav-link text-sm font-medium transition-colors ${
        isActive
          ? "nav-link-active text-charcoal"
          : "text-charcoal-light hover:text-charcoal"
      }`}
    >
      {label}
    </Link>
  );
}

function DropdownGroup({ group, isOpen, onToggle }: {
  group: typeof navGroups[0];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const hasActiveChild = group.items.some(item => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1 text-sm font-medium transition-colors ${
          isOpen || hasActiveChild
            ? "text-charcoal"
            : "text-charcoal-light hover:text-charcoal"
        }`}
        aria-expanded={isOpen}
      >
        {group.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 rounded-xl glass-strong shadow-lg shadow-black/5 py-2 animate-slide-down z-50">
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2 text-sm transition-colors ${
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "text-charcoal bg-black/5 font-medium"
                  : "text-charcoal-light hover:text-charcoal hover:bg-black/[0.03]"
              }`}
              onClick={() => onToggle()}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleGroup = (key: string) => {
    setOpenGroup(prev => prev === key ? null : key);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-peach to-accent-lavender">
                <span className="text-sm font-bold text-white">Ly</span>
              </div>
              <span className="text-base font-semibold text-charcoal tracking-tight hidden sm:block">
                Lyra
              </span>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="/"
                className={`nav-link text-sm font-medium transition-colors ${
                  pathname === "/"
                    ? "nav-link-active text-charcoal"
                    : "text-charcoal-light hover:text-charcoal"
                }`}
              >
                Dashboard
              </Link>
              {navGroups.map((group) => (
                <DropdownGroup
                  key={group.key}
                  group={group}
                  isOpen={openGroup === group.key}
                  onToggle={() => toggleGroup(group.key)}
                />
              ))}
              <Link
                href="/voice"
                className={`nav-link text-sm font-medium transition-colors ${
                  pathname === "/voice"
                    ? "nav-link-active text-charcoal"
                    : "text-charcoal-light hover:text-charcoal"
                }`}
              >
                Voice AI
              </Link>
            </div>

            {/* CTA + Mobile Toggle */}
            <div className="flex items-center gap-3">
              <Link
                href="/voice"
                className="btn-pill hidden sm:inline-flex items-center gap-2 border border-charcoal/10 bg-charcoal text-white px-5 py-2 text-sm font-medium hover:bg-charcoal/90 transition-all"
              >
                Voice AI
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <button
                className="md:hidden p-2 text-charcoal-light hover:text-charcoal transition-colors"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-16 left-0 right-0 glass-strong shadow-lg animate-slide-down">
            <div className="px-4 py-4 space-y-1">
              <Link
                href="/"
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/" ? "bg-charcoal/5 text-charcoal" : "text-charcoal-light hover:bg-charcoal/5"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                Dashboard
              </Link>
              {navGroups.map((group) => (
                <div key={group.key}>
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      openGroup === group.key ? "bg-charcoal/5 text-charcoal" : "text-charcoal-light hover:bg-charcoal/5"
                    }`}
                  >
                    {group.label}
                    <ChevronDown className={`h-4 w-4 transition-transform ${openGroup === group.key ? "rotate-180" : ""}`} />
                  </button>
                  {openGroup === group.key && (
                    <div className="ml-3 mt-1 space-y-0.5 border-l border-charcoal/10 pl-3">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            pathname === item.href || pathname.startsWith(`${item.href}/`)
                              ? "bg-charcoal/5 text-charcoal font-medium"
                              : "text-charcoal-light hover:bg-charcoal/5"
                          }`}
                          onClick={() => setMobileOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <Link
                href="/voice"
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/voice" ? "bg-charcoal/5 text-charcoal" : "text-charcoal-light hover:bg-charcoal/5"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                Voice AI
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}