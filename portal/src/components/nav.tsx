"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

export const navGroups = [
  {
    key: "overview",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    items: [
      { href: "/", label: "Dashboard" },
    ],
  },
  {
    key: "shops",
    label: "Shops",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l7 4.04a2 2 0 0 0 2.06 0l7-4.04a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71" />
        <path d="m22 7-10-5L2 7l10 5 10-5Z" />
        <path d="M6 9.5V17" />
        <path d="M18 9.5V17" />
      </svg>
    ),
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
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8v13H3V8" />
        <path d="M1 3h22v5H1z" />
        <path d="M10 12h4" />
      </svg>
    ),
    items: [
      { href: "/orders", label: "All Orders" },
      { href: "/orders/create", label: "Create Order" },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6" />
        <path d="M12 17v6" />
        <path d="M4.22 4.22l4.24 4.24" />
        <path d="M15.54 15.54l4.24 4.24" />
        <path d="M1 12h6" />
        <path d="M17 12h6" />
        <path d="M4.22 19.78l4.24-4.24" />
        <path d="M15.54 8.46l4.24-4.24" />
      </svg>
    ),
    items: [
      { href: "/deliveries", label: "Deliveries" },
      { href: "/admin/routes", label: "Routes" },
      { href: "/payments", label: "Payments" },
      { href: "/exceptions", label: "Exceptions", badge: 3 },
    ],
  },
  {
    key: "ai-copilot",
    label: "AI Co-Pilot",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
      </svg>
    ),
    items: [
      { href: "/voice", label: "Voice AI" },
      { href: "/shops/memory", label: "AI Memory" },
    ],
  },
  {
    key: "catalog",
    label: "Catalog",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
    items: [
      { href: "/catalog", label: "Products" },
      { href: "/catalog/inventory", label: "Inventory" },
      { href: "/admin/schemes", label: "Schemes" },
    ],
  },
];

export function NavLink({
  href,
  label,
  icon,
  badge,
  isChild = false,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  isChild?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-emerald-600 text-white"
          : isChild
          ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className="whitespace-nowrap flex-1">{label}</span>
      {badge && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-semibold">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function NavGroup({ group, isOpen, onToggle }: {
  group: typeof navGroups[0];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const hasActiveChild = group.items.some(item => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <div className="w-full">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isOpen || hasActiveChild
            ? "bg-emerald-600/20 text-emerald-400"
            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        }`}
        aria-expanded={isOpen}
      >
        {group.icon}
        <span className="whitespace-nowrap flex-1">{group.label}</span>
        {group.items.length > 1 && (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
      </button>
      {group.items.length > 1 && isOpen && (
        <div className="mt-1 ml-9 space-y-0.5 border-l border-zinc-800 pl-3 animate-slide-down">
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={null}
              badge={item.badge}
              isChild={true}
            />
          ))}
        </div>
      )}
      {group.items.length === 1 && (
        <NavLink
          key={group.items[0].href}
          href={group.items[0].href}
          label={group.items[0].label}
          icon={group.icon}
        />
      )}
    </div>
  );
}

export function Navigation() {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    overview: true,
    shops: false,
    orders: false,
    operations: false,
    "ai-copilot": false,
    catalog: false,
  });

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <nav className="flex flex-col gap-1 overflow-y-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:pb-0">
      {navGroups.map((group) => (
        <NavGroup
          key={group.key}
          group={group}
          isOpen={openGroups[group.key] ?? false}
          onToggle={() => toggleGroup(group.key)}
        />
      ))}
    </nav>
  );
}