type Props = { text: string; onClear: () => void };

export function NoResults({ text, onClear }: Props) {
  const q = text.trim();
  return (
    <section className="py-16" aria-live="polite">
      <h2 className="font-serif text-section text-ink">
        {q ? <>No songs match &ldquo;{q}&rdquo;</> : "No songs match these filters"}
      </h2>
      <p className="mt-2 text-ui text-ink-2">Search looks at titles and tags.</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 h-10 text-ui font-medium text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink sm:h-9"
      >
        Clear filters
      </button>
    </section>
  );
}
