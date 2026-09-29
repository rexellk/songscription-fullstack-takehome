"use client";

import { Pause, Play } from "@phosphor-icons/react";

type Props = {
  status: "idle" | "loading" | "playing" | "error";
  onToggle: () => void;
  label: string;
  className?: string;
  tone?: "paper" | "ebony";
};

/** Play and pause share one button; while the piano samples load it pulses instead of spinning. */
export function PreviewButton({ status, onToggle, label, className = "", tone = "paper" }: Props) {
  const playing = status === "playing";
  const loading = status === "loading";
  const colors = tone === "ebony" ? "bg-ebony-line text-ivory-note hover:bg-ebony" : "bg-paper-sunk text-ink-2 hover:text-ink";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={playing}
      aria-label={playing ? `Pause ${label}` : loading ? `Loading preview of ${label}` : `Play ${label}`}
      className={`flex h-8 w-8 items-center justify-center rounded before:absolute before:-inset-1 before:content-[''] ${colors} ${
        loading ? "animate-skeleton" : ""
      } ${className}`}
    >
      {playing ? <Pause size={16} weight="fill" aria-hidden /> : <Play size={16} weight={loading ? "light" : "fill"} aria-hidden />}
    </button>
  );
}
