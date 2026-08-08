"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Hammer, AlertTriangle, Shuffle, Rocket, Lightbulb, Settings } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const DESTINATIONS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/builds", label: "Builds", icon: Hammer },
  { href: "/failures", label: "Failures", icon: AlertTriangle },
  { href: "/flaky-tests", label: "Flaky tests", icon: Shuffle },
  { href: "/deployments", label: "Deployments", icon: Rocket },
  { href: "/recommendations", label: "Recommendations", icon: Lightbulb },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Jump to" description="Search BuildPilot">
      <CommandInput placeholder="Jump to a page, or search builds/failures..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {DESTINATIONS.map((d) => (
            <CommandItem key={d.href} onSelect={() => go(d.href)}>
              <d.icon className="size-4" />
              {d.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
