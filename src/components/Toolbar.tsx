"use client";

import { CaretDown, MagnifyingGlass, SortAscending, X } from "@phosphor-icons/react";
import { chip } from "@/components/ui";
import { useEffect, useRef } from "react";
import { FILTERS, SORTS, type Filter, type LibraryQuery, type SortKey } from "@/lib/query";

type Props = {
  query: LibraryQuery;
  keys: string[];
  total: number;
  shown: number;
  filtering: boolean;
  onChange: (patch: Partial<LibraryQuery>) => void;
};

const CONTROL =
  "h-10 rounded border border-rule bg-paper-raised text-ui text-ink transition-colors hover:border-rule-strong sm:h-9";

export function Toolbar({ query, keys, total, shown, filtering, onChange }: Props) {
  const search = useRef<HTMLInputElement>(null);

  // "/" jumps to search, like most tools people already use.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || target.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Search your library</span>
          <MagnifyingGlass
            size={18}
            weight="light"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <input
            ref={search}
            type="search"
            value={query.text}
            onChange={(e) => onChange({ text: e.target.value })}
            onKeyDown={(e) => e.key === "Escape" && query.text && onChange({ text: "" })}
            placeholder="Search your library"
            autoComplete="off"
            spellCheck={false}
            className={`${CONTROL} w-full pl-9 pr-9 placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden`}
          />
          {query.text && (
            <button
              type="button"
              onClick={() => {
                onChange({ text: "" });
                search.current?.focus();
              }}
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-ink-3 hover:text-ink"
              aria-label="Clear search"
            >
              <X size={16} weight="light" aria-hidden />
            </button>
          )}
        </label>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <label className="relative" title={`Sort: ${SORTS.find((s) => s.value === query.sort)?.label}`}>
            <span className="sr-only">Sort by</span>
            <SortAscending
              size={18}
              weight="light"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-2"
              aria-hidden
            />
            <select
              value={query.sort}
              onChange={(e) => onChange({ sort: e.target.value as SortKey })}
              className={`${CONTROL} appearance-none pl-9 pr-4 max-sm:w-10 max-sm:px-0 max-sm:text-transparent`}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value} className="text-ink">
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <div role="group" aria-label="Filter songs" className="flex shrink-0 gap-2">
          {FILTERS.map((f) => (
            <Chip key={f.value} selected={query.filter === f.value} onClick={() => onChange({ filter: f.value as Filter })}>
              {f.label}
            </Chip>
          ))}
        </div>
        {keys.length > 1 && (
          <label className="relative shrink-0">
            <span className="sr-only">Filter by key</span>
            <select
              value={query.key ?? ""}
              onChange={(e) => onChange({ key: e.target.value || null })}
              className={`h-10 appearance-none bg-transparent pl-3 pr-8 sm:h-8 ${chip(query.key !== null)}`}
            >
              <option value="">Any key</option>
              {keys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <CaretDown size={12} weight="light" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-2" aria-hidden />
          </label>
        )}
        <span className="ml-auto shrink-0 pl-2 font-mono text-meta text-ink-3" aria-live="polite">
          {filtering && (
            <>
              <span>
                {shown} of {total}
              </span>
              <span className="sr-only"> songs</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`h-10 shrink-0 px-3 sm:h-8 ${chip(selected)}`}
    >
      {children}
    </button>
  );
}
