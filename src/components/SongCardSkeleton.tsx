/** Same footprint as a real card, so nothing jumps when the song arrives. */
export function SongCardSkeleton({ fileName }: { fileName?: string }) {
  return (
    <div
      className="rounded border border-rule bg-paper-raised p-3"
      aria-busy="true"
      aria-label={fileName ? `Adding ${fileName}` : "Loading a song"}
    >
      <div className="h-24 animate-skeleton rounded-sm bg-paper-sunk" />
      {fileName ? (
        <>
          <p className="mt-3 truncate font-serif text-card-title text-ink-2">{fileName.replace(/\.midi?$/i, "")}</p>
          <p className="mt-1 font-mono text-meta text-ink-3">Reading notes…</p>
        </>
      ) : (
        <>
          <div className="mt-3 h-[25px] w-2/3 animate-skeleton rounded-sm bg-paper-sunk" />
          <div className="mt-1 h-[17px] w-1/2 animate-skeleton rounded-sm bg-paper-sunk" />
        </>
      )}
      <div className="mt-3 flex h-[17px] items-center justify-between">
        <div className="h-3 w-16 animate-skeleton rounded-sm bg-paper-sunk" />
        <div className="h-3 w-10 animate-skeleton rounded-sm bg-paper-sunk" />
      </div>
    </div>
  );
}
