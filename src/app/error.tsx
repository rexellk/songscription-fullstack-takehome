"use client";

import { useEffect } from "react";

/** Last line of defense: an unexpected error still lands on a calm, on-brand page with a way back. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-page px-4 pb-16 pt-6 sm:px-6">
      <div className="flex h-10 items-center border-b border-transparent">
        <span className="text-ui font-medium text-ink">Anything Piano</span>
      </div>
      <section className="mt-16 max-w-xl" role="alert">
        <h1 className="font-serif text-display-sm text-ink">Something went wrong</h1>
        <p className="mt-3 text-body text-ink-2">Your songs are safe. Try again to pick up where you left off.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 h-10 rounded border border-rule-strong px-4 text-ui font-medium text-ink hover:border-ink-3 sm:h-9"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
