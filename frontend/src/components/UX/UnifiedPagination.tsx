"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface UnifiedPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
}

export const UnifiedPagination: React.FC<UnifiedPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage = 10,
}) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems || 0);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t dark:border-neutral-800 border-border-subtle bg-white dark:bg-neutral-900 w-full text-xs">
      <div className="text-text-muted dark:text-neutral-400">
        {totalItems ? (
          <span>
            Showing <span className="font-semibold text-text-primary dark:text-white">{startItem}</span> to{" "}
            <span className="font-semibold text-text-primary dark:text-white">{endItem}</span> of{" "}
            <span className="font-semibold text-text-primary dark:text-white">{totalItems}</span> entries
          </span>
        ) : (
          <span>Page {currentPage} of {totalPages}</span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded dark:bg-neutral-800 bg-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-750 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
          title="First Page"
        >
          <ChevronsLeft size={14} className="dark:text-neutral-300 text-text-primary" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded dark:bg-neutral-800 bg-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-750 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
          title="Previous Page"
        >
          <ChevronLeft size={14} className="dark:text-neutral-300 text-text-primary" />
        </button>

        <span className="px-3 py-1 font-medium rounded dark:bg-neutral-850 bg-neutral-50 border dark:border-neutral-800 border-border-subtle dark:text-neutral-300 text-text-primary">
          {currentPage} / {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded dark:bg-neutral-800 bg-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-750 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
          title="Next Page"
        >
          <ChevronRight size={14} className="dark:text-neutral-300 text-text-primary" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded dark:bg-neutral-800 bg-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-750 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
          title="Last Page"
        >
          <ChevronsRight size={14} className="dark:text-neutral-300 text-text-primary" />
        </button>
      </div>
    </div>
  );
};
