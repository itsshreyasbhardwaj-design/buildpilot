import type { ReactNode } from "react";
import { requireSession } from "@/lib/current-session";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const organization = await db.organization.findUniqueOrThrow({ where: { id: session.organizationId } });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar organizationName={organization.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
