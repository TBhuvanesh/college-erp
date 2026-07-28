"use client";

import React from "react";
import { Search, X } from "lucide-react";

interface UnifiedSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const UnifiedSearchBar: React.FC<UnifiedSearchBarProps> = ({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <span className="absolute left-3 text-text-muted dark:text-neutral-500">
        <Search size={14} />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2.5 p-1 rounded-full text-text-muted hover:text-text-primary dark:text-neutral-500 dark:hover:text-white transition cursor-pointer"
          title="Clear search"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};
