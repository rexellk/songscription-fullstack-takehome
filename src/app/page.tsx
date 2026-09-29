import { Library } from "@/components/Library";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function LibraryPage() {
  return (
    <main className="mx-auto max-w-page px-4 pb-16 pt-6 sm:px-6">
      {isSupabaseConfigured ? <Library /> : <SetupNotice />}
    </main>
  );
}

/** Shown to anyone who clones the repo without a .env.local, instead of a blank page. */
function SetupNotice() {
  return (
    <>
      <header className="border-b border-rule pb-6">
        <div className="flex h-10 items-center">
          <span className="text-ui font-medium text-ink">Anything Piano</span>
        </div>
        <h1 className="mt-10 font-serif text-display-sm text-ink sm:text-display">Library</h1>
      </header>
      <section className="mt-10 max-w-xl">
        <h2 className="font-serif text-section text-ink">Connect a database to begin</h2>
        <p className="mt-2 text-body text-ink-2">
          Your library is stored in Supabase. Run{" "}
          <code className="font-mono text-meta text-ink">supabase/schema.sql</code> in a new project, then add
          its URL and anon key to <code className="font-mono text-meta text-ink">.env.local</code> and restart
          the dev server.
        </p>
      </section>
    </>
  );
}
