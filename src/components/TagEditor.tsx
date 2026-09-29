"use client";

import { X } from "@phosphor-icons/react";
import { useState } from "react";

export const SUGGESTED_TAGS = ["warm-up", "recital", "by ear", "left hand work", "slow practice"];
const MAX_TAG = 24;

type Props = { tags: string[]; onChange: (tags: string[]) => void };

export function TagEditor({ tags, onChange }: Props) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_TAG);
    setDraft("");
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag]);
  };

  const suggestions = SUGGESTED_TAGS.filter((t) => !tags.includes(t)).slice(0, 3);

  return (
    <div>
      <h4 id="tags-title" className="text-ui font-medium text-ink">
        Tags
      </h4>
      <ul className="mt-2 flex flex-wrap gap-2" aria-labelledby="tags-title">
        {tags.map((t) => (
          <li key={t} className="flex h-10 items-center rounded-sm border border-rule bg-paper-sunk pl-3 text-ui text-ink sm:h-8 sm:pl-2">
            {t}
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="flex h-10 w-10 items-center justify-center text-ink-3 hover:text-ink sm:h-8 sm:w-7"
              aria-label={`Remove tag ${t}`}
            >
              <X size={12} weight="light" aria-hidden />
            </button>
          </li>
        ))}
        <li>
          <label>
            <span className="sr-only">Add a tag</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  add(draft);
                } else if (e.key === "Backspace" && !draft && tags.length) {
                  onChange(tags.slice(0, -1));
                } else if (e.key === "Escape" && draft) {
                  e.stopPropagation();
                  setDraft("");
                }
              }}
              onBlur={() => draft && add(draft)}
              maxLength={MAX_TAG}
              placeholder="Add a tag"
              className="h-10 w-32 rounded-sm border border-dashed sm:h-8 border-rule-strong bg-transparent px-2 text-ui text-ink placeholder:text-ink-3 focus:border-solid"
            />
          </label>
        </li>
      </ul>
      {suggestions.length > 0 && (
        <p className="mt-2 text-meta text-ink-3">
          Try{" "}
          {suggestions.map((t, i) => (
            <span key={t}>
              <button type="button" onClick={() => add(t)} className="text-ink-2 underline decoration-rule-strong underline-offset-2 hover:text-ink">
                {t}
              </button>
              {i < suggestions.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
