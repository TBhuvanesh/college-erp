"use client";

import { LucideIcon, ArrowRight } from "lucide-react";
import Link from "next/link";

export interface ShortcutItem {
  label: string;
  route: string;
  icon: LucideIcon;
  description?: string;
  badge?: string;
}

interface QuickActionsProps {
  shortcuts: ShortcutItem[];
  title?: string;
}

export function QuickActions({ shortcuts, title = "Quick Operations" }: QuickActionsProps) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
      <div>
        <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
          {title}
        </h3>
        <p className="text-[11px] text-text-muted mt-0.5">Frequent operations shortcuts</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {shortcuts.map((shortcut, idx) => {
          const Icon = shortcut.icon;
          return (
            <Link
              key={idx}
              href={shortcut.route}
              className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-border-subtle bg-background hover:bg-surface-hover/30 hover:border-border-hover text-center transition-all group"
            >
              <div className="relative">
                <Icon className="h-5 w-5 text-accent-blue group-hover:scale-110 transition-transform" />
                {shortcut.badge && (
                  <span className="absolute -top-1.5 -right-2 px-1 py-0.5 rounded-full text-[7px] font-extrabold uppercase bg-red-500 text-white animate-pulse">
                    {shortcut.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold text-text-secondary mt-2.5 leading-none">
                {shortcut.label}
              </span>
              {shortcut.description && (
                <span className="text-[8px] text-text-muted mt-1 leading-none max-w-[80px] truncate block">
                  {shortcut.description}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
