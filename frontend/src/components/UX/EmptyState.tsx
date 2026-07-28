"use client";

import React from "react";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionButton?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No data found",
  description = "There are no records matching your current filter configuration or search query.",
  icon = <FolderOpen className="h-10 w-10 text-neutral-400 dark:text-neutral-500" />,
  actionButton,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border dark:border-neutral-800 border-border-subtle rounded-xl bg-white dark:bg-neutral-900 min-h-[300px] w-full">
      <div className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-full mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-text-primary dark:text-white mb-1">
        {title}
      </h3>
      <p className="text-xs text-text-muted dark:text-neutral-400 max-w-sm mb-4">
        {description}
      </p>
      {actionButton && <div>{actionButton}</div>}
    </div>
  );
};
