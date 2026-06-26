"use client";

import React from "react";
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  description?: string;
  trend?: {
    label: string;
    value: string;
    positive?: boolean;
  };
  bgClass?: string;
  iconClass?: string;
  onClick?: () => void;
  children?: React.ReactNode; // For charts
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  description,
  trend,
  bgClass = "bg-surface border-border-subtle shadow-sm",
  iconClass = "bg-accent-blue-soft text-accent-blue",
  onClick,
  children
}) => {
  const cardContent = (
    <div className={`rounded-[16px] p-5 border flex flex-col justify-between transition-all duration-300 relative overflow-hidden group ${
      onClick ? "cursor-pointer hover:border-border-strong hover:bg-surface-hover hover:shadow-md hover:-translate-y-0.5" : ""
    } ${bgClass}`}>
      
      {/* Top Header Row */}
      <div className="flex items-start justify-between z-10 relative">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
            {title}
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="font-display font-bold text-2xl text-text-primary select-all">
              {value}
            </h3>
            {trend && (
              <div className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                trend.positive ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
              }`}>
                {trend.positive ? <ArrowUpRight size={12} className="mr-0.5" /> : <ArrowDownRight size={12} className="mr-0.5" />}
                {trend.value}
              </div>
            )}
          </div>
        </div>

        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconClass} transition-transform group-hover:scale-110`}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
      </div>

      {/* Optional Children (Charts) */}
      {children && (
        <div className="mt-3 z-10 relative">
          {children}
        </div>
      )}

      {/* Footer Description */}
      {description && !children && (
        <div className="mt-4 pt-3 border-t border-border-subtle/50 z-10 relative">
          <span className="text-[11px] text-text-secondary font-medium">
            {description}
          </span>
        </div>
      )}
    </div>
  );

  if (onClick) {
    return <button onClick={onClick} className="w-full text-left focus:outline-none block">{cardContent}</button>;
  }

  return cardContent;
};
