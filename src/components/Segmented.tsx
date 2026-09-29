"use client";

/**
 * Equal-width options with real radio inputs underneath, so arrow keys and screen
 * readers work without extra code. Used for every setting, in the popover and the drawer.
 */
export function Segmented<T extends string | number>({
  legend,
  name,
  value,
  options,
  onChange,
  hint,
}: {
  legend: string;
  name: string;
  value: T | null;
  options: { value: T | null; label: string }[];
  onChange: (value: T | null) => void;
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="text-meta text-ink-3">{legend}</legend>
      <div
        className="mt-2 grid gap-1 rounded-sm border border-rule p-0.5"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label key={String(o.value)} className="relative">
              <input
                type="radio"
                name={name}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="peer absolute inset-0 cursor-pointer opacity-0"
              />
              <span
                className={`flex h-10 items-center justify-center rounded-sm border text-ui transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-brass sm:h-8 ${
                  checked ? "border-brass bg-brass-soft text-ink" : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {o.label}
              </span>
            </label>
          );
        })}
      </div>
      {hint && <p className="mt-1 text-meta text-ink-3">{hint}</p>}
    </fieldset>
  );
}
