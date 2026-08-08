"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Hammer,
  AlertTriangle,
  Shuffle,
  Rocket,
  Lightbulb,
  Settings,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/builds", label: "Builds", icon: Hammer },
  { href: "/failures", label: "Failures", icon: AlertTriangle },
  { href: "/flaky-tests", label: "Flaky tests", icon: Shuffle },
  { href: "/deployments", label: "Deployments", icon: Rocket },
  { href: "/recommendations", label: "Recommendations", icon: Lightbulb },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ organizationName }: { organizationName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex size-6 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground">
          <GitBranch className="size-3.5" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">BuildPilot</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <p className="truncate text-xs font-medium text-sidebar-foreground">{organizationName}</p>
        <p className="text-[11px] text-sidebar-foreground/50">Demo workspace</p>
      </div>
    </aside>
  );
}
