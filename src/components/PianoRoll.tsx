"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef } from "react";
import type { PreviewNote } from "@/types";

type Props = {
  notes: PreviewNote[];
  /** Pitch range to show. Defaults to the range of `notes`, so the roll is never half empty. */
  low?: number;
  high?: number;
  height: number;
  variant?: "paper" | "ebony";
  /** Seconds into the song; draws a brass playhead when set. */
  playheadSec?: number | null;
  /** Only draw the first N seconds (the drawer preview), otherwise the whole song. */
  windowSec?: number;
  /** Notes at full strength (hover or focus) vs. resting at 85%. */
  emphasized?: boolean;
  className?: string;
  label?: string;
};

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
const MIN_SPAN = 14; // a scale shouldn't render as three fat bars
const RIGHT_HAND_FROM = 60;

function readTokens() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(`--${name}`).trim();
  return {
    paperBg: v("paper-sunk"),
    paperLane: v("lane"),
    ink: v("ink"),
    brass: v("brass"),
    ebonyBg: v("ebony"),
    ebonyLane: v("ebony-line"),
    ivory: v("ivory-note"),
  };
}

/**
 * The song's real notes, drawn as a piano roll. Time runs left to right, pitch bottom to top,
 * black-key rows are shaded, right hand in ink (ivory on ebony), left hand in brass.
 * Canvas pixels don't follow CSS, so this redraws on resize, theme change, and prop change.
 */
export function PianoRoll({
  notes,
  low,
  high,
  height,
  variant = "paper",
  playheadSec = null,
  windowSec,
  emphasized = false,
  className = "",
  label,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

  const draw = useCallback(() => {
    const el = canvas.current;
    if (!el) return;
    const width = el.clientWidth;
    if (width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (el.width !== Math.round(width * dpr) || el.height !== Math.round(height * dpr)) {
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
    }
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const t = readTokens();
    const ebony = variant === "ebony";
    ctx.fillStyle = ebony ? t.ebonyBg : t.paperBg;
    ctx.fillRect(0, 0, width, height);

    const end = notes.reduce((m, n) => Math.max(m, n.t + n.d), 0);
    const span = windowSec ? Math.min(windowSec, end || windowSec) : end;
    const visible = windowSec ? notes.filter((n) => n.t <= span) : notes;

    // Pitch window fitted to the notes on screen: 2 semitones of air, at least MIN_SPAN tall.
    let lo = (low ?? visible.reduce((m, n) => Math.min(m, n.p), 127)) - 2;
    let hi = (high ?? visible.reduce((m, n) => Math.max(m, n.p), 0)) + 2;
    if (lo > hi) [lo, hi] = [58, 74];
    if (hi - lo < MIN_SPAN) {
      const pad = (MIN_SPAN - (hi - lo)) / 2;
      lo = Math.floor(lo - pad);
      hi = Math.ceil(hi + pad);
    }
    const rows = hi - lo + 1;
    const rowH = height / rows;

    ctx.fillStyle = ebony ? t.ebonyLane : t.paperLane;
    for (let p = lo; p <= hi; p++) {
      if (BLACK_KEYS.has(((p % 12) + 12) % 12)) ctx.fillRect(0, (hi - p) * rowH, width, rowH);
    }

    if (span <= 0) return;
    const pxPerSec = width / span;
    const noteH = Math.max(1, rowH - (rowH > 4 ? 1 : 0));
    const radius = Math.min(1, noteH / 2);

    ctx.globalAlpha = emphasized ? 1 : 0.85;
    for (const hand of ["left", "right"] as const) {
      ctx.fillStyle = hand === "left" ? t.brass : ebony ? t.ivory : t.ink;
      ctx.beginPath();
      for (const n of visible) {
        if ((n.p >= RIGHT_HAND_FROM) !== (hand === "right")) continue;
        const x = n.t * pxPerSec;
        const w = Math.max(2, n.d * pxPerSec - 0.5);
        const y = (hi - n.p) * rowH + (rowH - noteH) / 2;
        ctx.roundRect(x, y, w, noteH, radius);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (playheadSec != null && playheadSec >= 0) {
      const x = Math.min(width - 1, playheadSec * pxPerSec);
      ctx.fillStyle = t.brass;
      ctx.fillRect(Math.round(x), 0, 1.5, height);
    }
  }, [notes, low, high, height, variant, playheadSec, windowSec, emphasized]);

  // Redraw after the theme attribute lands, so getComputedStyle sees the new tokens.
  useEffect(() => {
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [draw, resolvedTheme]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <canvas
      ref={canvas}
      className={`block w-full ${className}`}
      style={{ height }}
      role="img"
      aria-label={label ?? "Piano roll preview of the notes"}
    />
  );
}
