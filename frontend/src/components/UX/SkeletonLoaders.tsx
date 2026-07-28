"use client";

import React from "react";

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => {
  return (
    <div className="w-full animate-pulse border dark:border-neutral-800 border-border-subtle rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
      <div className="bg-neutral-50 dark:bg-neutral-850 h-10 border-b dark:border-neutral-800 border-border-subtle flex items-center px-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded flex-1 mr-4 last:mr-0" />
        ))}
      </div>
      <div className="divide-y dark:divide-neutral-800 divide-border-subtle">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="h-12 flex items-center px-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded flex-1 mr-4 last:mr-0" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SkeletonCard: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse p-4 rounded-xl border dark:border-neutral-800 border-border-subtle bg-white dark:bg-neutral-900 space-y-3"
        >
          <div className="h-4 w-1/3 bg-neutral-200 dark:bg-neutral-700 rounded" />
          <div className="h-8 w-2/3 bg-neutral-100 dark:bg-neutral-800 rounded" />
          <div className="h-3 w-1/2 bg-neutral-100 dark:bg-neutral-800 rounded" />
        </div>
      ))}
    </div>
  );
};

export const SkeletonDropdown: React.FC = () => {
  return (
    <div className="animate-pulse h-9 w-full bg-neutral-100 dark:bg-neutral-800 border dark:border-neutral-800 border-border-subtle rounded" />
  );
};
