"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

// ── Filter option types ──
export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "search" | "toggle";
  options?: FilterOption[];
  placeholder?: string;
  icon?: string;
}

// ── Active filter representation ──
interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  displayLabel: string;
}

interface SearchFilterBarProps {
  /** Filter configurations */
  filters: FilterConfig[];
  /** Current filter values (key -> value) */
  values: Record<string, string>;
  /** Called when any filter value changes */
  onChange: (key: string, value: string) => void;
  /** Called when user submits search */
  onSearch?: () => void;
  /** Called when user clears all filters */
  onClearAll: () => void;
  /** Called when user removes a single filter */
  onRemoveFilter: (key: string) => void;
  /** Total results count to display */
  totalResults?: number;
  /** Whether a search is in progress */
  loading?: boolean;
  /** Search button label */
  searchLabel?: string;
  /** Quick filter chips */
  quickFilters?: { label: string; key: string; value: string }[];
  /** Sort options */
  sortOptions?: FilterOption[];
  /** Current sort value */
  sortBy?: string;
  /** Sort change handler */
  onSortChange?: (value: string) => void;
  /** Additional actions in the toolbar */
  actions?: React.ReactNode;
  /** Placeholder for the main search input */
  searchPlaceholder?: string;
  /** Facet counts per filter key: { type: { venture_capital: 2822, ... } } */
  facetCounts?: Record<string, Record<string, number>>;
  /** Saved filters list */
  savedFilters?: { id: string; name: string; filters: Record<string, string>; sortBy?: string }[];
  /** Called when user saves current filters */
  onSaveFilter?: (name: string) => void;
  /** Called when user loads a saved filter */
  onLoadFilter?: (filter: { filters: Record<string, string>; sortBy?: string }) => void;
  /** Called when user deletes a saved filter */
  onDeleteFilter?: (id: string) => void;
  /** Whether a save is in progress */
  saving?: boolean;
}

export function SearchFilterBar({
  filters,
  values,
  onChange,
  onSearch,
  onClearAll,
  onRemoveFilter,
  totalResults,
  loading = false,
  searchLabel = "Search",
  quickFilters,
  sortOptions,
  sortBy,
  onSortChange,
  actions,
  searchPlaceholder = "Search by name, email, firm, or title...",
  facetCounts,
  savedFilters = [],
  onSaveFilter,
  onLoadFilter,
  onDeleteFilter,
  saving = false,
}: SearchFilterBarProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSavedList, setShowSavedList] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [expanded, setExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Build active filters list
  const activeFilters: ActiveFilter[] = [];
  for (const filter of filters) {
    const val = values[filter.key] || "";
    if (val) {
      if (filter.type === "select") {
        const opt = filter.options?.find((o) => o.value === val);
        activeFilters.push({
          key: filter.key,
          label: filter.label,
          value: val,
          displayLabel: `${filter.label}: ${opt?.label || val}`,
        });
      } else {
        activeFilters.push({
          key: filter.key,
          label: filter.label,
          value: val,
          displayLabel: `${filter.label}: "${val}"`,
        });
      }
    }
  }

  const hasActiveFilters = activeFilters.length > 0;

  // Keyboard shortcut: Enter to search
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onSearch) {
      e.preventDefault();
      onSearch();
    }
  };

  // Count non-empty filters
  const filterCount = filters.filter((f) => values[f.key]).length;

  return (
    <div className="mb-[20px]">
      {/* Main search bar */}
      <div className="bg-white dark:bg-[#0d1b16] border border-gray-200 dark:border-gray-800 rounded-[12px] overflow-hidden">
        {/* Search row */}
        <div className="flex items-center gap-[8px] p-[16px]">
          {/* Search icon */}
          <i className="ri-search-line text-gray-400 text-[18px] flex-none"></i>

          {/* Main search input */}
          <input
            ref={searchInputRef}
            type="text"
            value={values.search || ""}
            onChange={(e) => onChange("search", e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="flex-1 text-[14px] bg-transparent focus:outline-none placeholder:text-gray-400 text-[#06201b] dark:text-white min-w-0"
          />

          {/* Filter toggle button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className={`flex items-center gap-[8px] px-[12px] py-[8px] text-[13px] font-medium rounded-[8px] border transition-all flex-none ${
              expanded || hasActiveFilters
                ? "bg-lime-50 dark:bg-lime-900/20 border-lime-300 dark:border-lime-700 text-lime-700 dark:text-lime-400"
                : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
            }`}
          >
            <i className="ri-filter-3-line text-[14px]"></i>
            Filters
            {filterCount > 0 && (
              <span className="w-[18px] h-[18px] rounded-full bg-lime-500 text-black text-[11px] font-bold flex items-center justify-center">
                {filterCount}
              </span>
            )}
            <i
              className={`ri-arrow-down-s-line text-[14px] transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            ></i>
          </button>

          {/* Search button */}
          {onSearch && (
            <Button size="sm" onClick={onSearch} disabled={loading}>
              {loading ? (
                <i className="ri-loader-4-line animate-spin text-[14px]"></i>
              ) : (
                searchLabel
              )}
            </Button>
          )}

          {/* Saved Filters */}
          {onSaveFilter && (
            <div className="relative flex-none">
              <button
                onClick={() => setShowSavedList(!showSavedList)}
                className="flex items-center gap-[8px] px-[10px] py-[8px] text-[13px] font-medium rounded-[8px] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-lime-400 hover:text-lime-600 transition-all"
                title="Saved Filters"
              >
                <i className="ri-bookmark-line text-[14px]"></i>
                {savedFilters.length > 0 && (
                  <span className="w-[18px] h-[18px] rounded-full bg-gray-200 dark:bg-gray-700 text-[11px] font-bold flex items-center justify-center">
                    {savedFilters.length}
                  </span>
                )}
              </button>

              {/* Saved filters dropdown */}
              {showSavedList && (
                <div className="absolute right-0 top-full mt-[8px] w-[280px] bg-white dark:bg-[#0d1b16] border border-gray-200 dark:border-gray-800 rounded-[12px] shadow-lg z-50 overflow-hidden">
                  <div className="p-[12px] border-b border-gray-100 dark:border-gray-800">
                    <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider !mb-0">Saved Filters</p>
                  </div>
                  {savedFilters.length === 0 ? (
                    <div className="p-[20px] text-center">
                      <p className="text-[13px] text-gray-400 !mb-0">No saved filters yet.</p>
                      <p className="text-[11px] text-gray-300 !mb-0">Apply filters, then click the save icon.</p>
                    </div>
                  ) : (
                    <div className="max-h-[250px] overflow-y-auto">
                      {savedFilters.map((sf) => (
                        <div
                          key={sf.id}
                          className="flex items-center gap-[8px] px-[12px] py-[10px] hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer group border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                          onClick={() => {
                            onLoadFilter?.({ filters: sf.filters, sortBy: sf.sortBy });
                            setShowSavedList(false);
                          }}
                        >
                          <i className="ri-bookmark-fill text-lime-500 text-[14px] flex-none"></i>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0 truncate">{sf.name}</p>
                            <p className="text-[11px] text-gray-400 !mb-0">
                              {Object.entries(sf.filters).filter(([,v]) => v).length} filter{Object.entries(sf.filters).filter(([,v]) => v).length !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteFilter?.(sf.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-[4px]"
                            title="Delete"
                          >
                            <i className="ri-close-circle-line text-[16px]"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Save current filters */}
          {onSaveFilter && filterCount > 0 && (
            <div className="relative flex-none">
              <button
                onClick={() => setShowSaveDialog(!showSaveDialog)}
                disabled={saving}
                className="flex items-center gap-[8px] px-[10px] py-[8px] text-[13px] font-medium rounded-[8px] border border-lime-300 dark:border-lime-700 text-lime-700 dark:text-lime-400 hover:bg-lime-50 dark:hover:bg-lime-900/20 transition-all"
                title="Save this filter"
              >
                {saving ? (
                  <i className="ri-loader-4-line animate-spin text-[14px]"></i>
                ) : (
                  <i className="ri-save-line text-[14px]"></i>
                )}
                Save
              </button>

              {/* Save dialog */}
              {showSaveDialog && (
                <div className="absolute right-0 top-full mt-[8px] w-[260px] bg-white dark:bg-[#0d1b16] border border-gray-200 dark:border-gray-800 rounded-[12px] shadow-lg z-50 p-[16px]">
                  <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider !mb-[8px]">Save Filter</p>
                  <input
                    type="text"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && filterName.trim()) {
                        onSaveFilter(filterName.trim());
                        setFilterName("");
                        setShowSaveDialog(false);
                      }
                    }}
                    placeholder="e.g. AI VCs in US"
                    autoFocus
                    className="w-full py-[8px] px-[12px] text-[13px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 text-[#06201b] dark:text-white !mb-[8px]"
                  />
                  <div className="flex gap-[8px]">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (filterName.trim()) {
                          onSaveFilter(filterName.trim());
                          setFilterName("");
                          setShowSaveDialog(false);
                        }
                      }}
                      disabled={!filterName.trim() || saving}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setShowSaveDialog(false); setFilterName(""); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Extra actions */}
          {actions}
        </div>

        {/* Quick filter chips */}
        {quickFilters && quickFilters.length > 0 && (
          <div className="px-[16px] pb-[12px] flex flex-wrap gap-[8px]">
            {quickFilters.map((qf) => {
              const isActive = values[qf.key] === qf.value;
              return (
                <button
                  key={qf.label}
                  onClick={() => onChange(qf.key, isActive ? "" : qf.value)}
                  className={`px-[10px] py-[4px] text-[12px] font-medium rounded-full border transition-all ${
                    isActive
                      ? "bg-lime-500 text-black border-lime-500"
                      : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-lime-400 hover:text-lime-600"
                  }`}
                >
                  {qf.label}{facetCounts?.[qf.key]?.[qf.value] !== undefined ? (
                    <span className="ml-[4px] opacity-60">{facetCounts[qf.key][qf.value].toLocaleString()}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {/* Expanded filter panel */}
        {expanded && (
          <div className="border-t border-gray-100 dark:border-gray-800 p-[16px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[12px]">
              {filters.map((filter) => {
                if (filter.type === "toggle") {
                  const isActive = values[filter.key] === "true";
                  return (
                    <div key={filter.key}>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 !mb-[6px]">
                        {filter.label}
                      </label>
                      <div className="flex gap-[8px]">
                        <button
                          onClick={() =>
                            onChange(
                              filter.key,
                              isActive ? "" : "true"
                            )
                          }
                          className={`flex-1 py-[8px] text-[12px] font-medium rounded-[6px] border transition-all ${
                            isActive
                              ? "bg-lime-50 dark:bg-lime-900/20 border-lime-300 text-lime-700 dark:text-lime-400"
                              : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500"
                          }`}
                        >
                          <i className="ri-check-line mr-[4px]"></i> Yes
                        </button>
                        <button
                          onClick={() =>
                            onChange(
                              filter.key,
                              values[filter.key] === "false" ? "" : "false"
                            )
                          }
                          className={`flex-1 py-[8px] text-[12px] font-medium rounded-[6px] border transition-all ${
                            values[filter.key] === "false"
                              ? "bg-red-50 dark:bg-red-900/20 border-red-300 text-red-600 dark:text-red-400"
                              : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500"
                          }`}
                        >
                          <i className="ri-close-line mr-[4px]"></i> No
                        </button>
                      </div>
                    </div>
                  );
                }

                if (filter.type === "select") {
                  return (
                    <div key={filter.key}>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 !mb-[6px]">
                        {filter.label}
                      </label>
                      <select
                        value={values[filter.key] || ""}
                        onChange={(e) => onChange(filter.key, e.target.value)}
                        className="w-full py-[8px] px-[12px] text-[13px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 text-[#06201b] dark:text-white"
                      >
                        <option value="">All {filter.label}</option>
                        {filter.options?.map((opt) => {
                          const count = facetCounts?.[filter.key]?.[opt.value];
                          return (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}{count !== undefined ? ` (${count.toLocaleString()})` : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  );
                }

                // search type (text input for specific filters)
                return (
                  <div key={filter.key}>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 !mb-[6px]">
                      {filter.label}
                    </label>
                    <div className="relative">
                      {filter.icon && (
                        <i
                          className={`${filter.icon} absolute left-[10px] top-1/2 -translate-y-1/2 text-gray-400 text-[14px]`}
                        ></i>
                      )}
                      <input
                        type="text"
                        value={values[filter.key] || ""}
                        onChange={(e) => onChange(filter.key, e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={filter.placeholder || `Filter by ${filter.label.toLowerCase()}...`}
                        className={`w-full py-[8px] text-[13px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 text-[#06201b] dark:text-white ${
                          filter.icon ? "pl-[32px] pr-[12px]" : "px-[12px]"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Sort dropdown */}
              {sortOptions && onSortChange && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 !mb-[6px]">
                    Sort By
                  </label>
                  <select
                    value={sortBy || ""}
                    onChange={(e) => onSortChange(e.target.value)}
                    className="w-full py-[8px] px-[12px] text-[13px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 text-[#06201b] dark:text-white"
                  >
                    {sortOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Bottom row: clear + info */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between mt-[12px] pt-[10px] border-t border-gray-100 dark:border-gray-800">
                <p className="text-[12px] text-gray-400 !mb-0">
                  {filterCount} filter{filterCount !== 1 ? "s" : ""} active
                </p>
                <button
                  onClick={onClearAll}
                  className="text-[12px] text-red-500 hover:text-red-600 font-medium flex items-center gap-[4px]"
                >
                  <i className="ri-close-circle-line text-[14px]"></i>
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex items-center gap-[8px] mt-[10px] flex-wrap">
          <span className="text-[11px] text-gray-400 font-medium">Active:</span>
          {activeFilters.map((af) => (
            <Badge
              key={af.key}
              variant="primary"
              size="sm"
              className="cursor-pointer hover:bg-lime-200 dark:hover:bg-lime-800 transition-colors pr-[6px]"
              onClick={() => onRemoveFilter(af.key)}
            >
              {af.displayLabel}
              <i className="ri-close-line ml-[4px] text-[12px]"></i>
            </Badge>
          ))}
          <button
            onClick={onClearAll}
            className="text-[11px] text-gray-400 hover:text-red-500 font-medium ml-[4px]"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results count */}
      {totalResults !== undefined && (
        <div className="flex items-center gap-[8px] mt-[8px]">
          <p className="text-[13px] text-gray-500 !mb-0">
            <span className="font-semibold text-[#06201b] dark:text-white">
              {totalResults.toLocaleString()}
            </span>{" "}
            result{totalResults !== 1 ? "s" : ""}
            {hasActiveFilters && (
              <span className="text-gray-400"> matching filters</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
