"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

export type FilePickerHandle = { open: () => void };

/** Hidden file input. Anything that wants to "add a song" calls `ref.open()`. */
export function FilePicker({ ref, onFiles }: { ref: Ref<FilePickerHandle>; onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ open: () => input.current?.click() }), []);

  return (
    <input
      ref={input}
      type="file"
      accept=".mid,.midi,audio/midi,audio/x-midi"
      multiple
      hidden
      onChange={(e) => {
        onFiles(Array.from(e.target.files ?? []));
        e.target.value = ""; // allow picking the same file again, so a duplicate is reported instead of ignored
      }}
    />
  );
}

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

/**
 * Lets a file be dropped anywhere on the page. A counter tracks enter/leave pairs,
 * because dragleave fires every time the pointer crosses into a child element.
 */
export function useWindowFileDrop(onFiles: (files: File[]) => void) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const onFilesRef = useRef(onFiles);
  useEffect(() => {
    onFilesRef.current = onFiles;
  }, [onFiles]);

  useEffect(() => {
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setActive(true);
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setActive(false);
      onFilesRef.current(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  return active;
}

export function DropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 animate-fade-in bg-[color-mix(in_srgb,var(--paper)_92%,transparent)] p-4"
    >
      <div className="flex h-full items-center justify-center rounded border border-dashed border-rule-strong">
        <div className="rounded border border-rule bg-paper-raised px-8 py-6 text-center">
          <p className="font-serif text-display-sm text-ink">Drop to add to your library</p>
          <p className="mt-2 font-mono text-meta text-ink-3">.mid or .midi, up to 5 MB each</p>
        </div>
      </div>
    </div>
  );
}
