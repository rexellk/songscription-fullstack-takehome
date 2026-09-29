"use client";

import { useEffect, useRef, useState } from "react";
import { ParticlePool, THEMES } from "@/lib/particles";
import { player, previewStart } from "@/lib/player";
import type { PracticeTheme, PreviewNote } from "@/types";

type Props = {
  songId: string;
  notes: PreviewNote[];
  theme: PracticeTheme;
  playing: boolean;
  className?: string;
};

const BLACK = new Set([1, 3, 6, 8, 10]);
const LOOKAHEAD_SEC = 2.5;
const KEYBOARD_H = 56;
const RIGHT_HAND_FROM = 60;

const isBlack = (p: number) => BLACK.has(((p % 12) + 12) % 12);

/**
 * The keyboard covers the song's range, widened to whole octaves (at least three),
 * so keys stay wide enough to read in a 460px panel. A full 88 keys would be 8px each.
 */
function keyboardRange(notes: PreviewNote[]) {
  let lo = notes.reduce((m, n) => Math.min(m, n.p), 127);
  let hi = notes.reduce((m, n) => Math.max(m, n.p), 0);
  if (lo > hi) [lo, hi] = [48, 84];
  lo = Math.max(21, lo - (lo % 12));
  hi = Math.min(108, hi + (11 - (hi % 12)));
  while (hi - lo < 35) {
    if (lo > 21) lo -= 12;
    else hi += 12;
  }
  return [lo, Math.min(hi, 108)] as const;
}

function layout(lo: number, hi: number, width: number) {
  const whites: number[] = [];
  for (let p = lo; p <= hi; p++) if (!isBlack(p)) whites.push(p);
  const ww = width / whites.length;
  const bw = ww * 0.6;
  const x = new Map<number, { x: number; w: number; black: boolean }>();
  whites.forEach((p, i) => x.set(p, { x: i * ww, w: ww, black: false }));
  for (let p = lo; p <= hi; p++) {
    if (!isBlack(p)) continue;
    const left = x.get(p - 1);
    if (left) x.set(p, { x: left.x + ww - bw / 2, w: bw, black: true });
  }
  return x;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}

/**
 * Falling-notes view on one canvas: notes drop toward a brass hit line above a keyboard,
 * keys light as notes land, and the practice theme bursts particles from each key.
 * Time comes from the audio clock, so what you see is what you hear.
 */
export function PracticeStage({ songId, notes, theme, playing, className = "" }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pool = useRef<ParticlePool | null>(null);
  const reduced = useReducedMotion();

  // Reduced motion keeps the notes but drops the particles.
  const effectiveTheme: PracticeTheme = reduced ? "off" : theme;
  useEffect(() => {
    if (!pool.current) pool.current = new ParticlePool(THEMES[effectiveTheme]);
    else pool.current.setTheme(THEMES[effectiveTheme]);
  }, [effectiveTheme]);

  useEffect(() => {
    const el = canvas.current;
    const container = box.current;
    if (!el || !container) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const sorted = [...notes].sort((a, b) => a.t - b.t);
    const [lo, hi] = keyboardRange(sorted);
    let width = 0;
    let height = 0;
    let keys = layout(lo, hi, 1);
    let colors = { ebony: "", line: "", ivory: "", brass: "", key: "" };
    const readColors = () => {
      colors = {
        ebony: token("ebony"),
        line: token("ebony-line"),
        ivory: token("ivory-note"),
        brass: token("brass"),
        key: token(THEMES[effectiveTheme].keyColor),
      };
    };
    readColors();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = container.clientWidth;
      height = container.clientHeight;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      keys = layout(lo, hi, width);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    const themeObserver = new MutationObserver(readColors);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    // At rest, show the moment just before the first note, so the stage never looks empty.
    const restAt = previewStart(sorted);
    let spawnFrom = 0;
    let lastNow = -1;
    let lastFrame = performance.now();
    let frame = 0;

    const draw = (ts: number) => {
      const dt = Math.min(0.05, (ts - lastFrame) / 1000);
      lastFrame = ts;
      const now = playing ? player.position() : restAt;
      if (now < lastNow) spawnFrom = 0; // playback restarted
      lastNow = now;

      const hitY = height - KEYBOARD_H - 2;
      ctx.fillStyle = colors.ebony;
      ctx.fillRect(0, 0, width, height);

      // Octave guides at every C.
      ctx.fillStyle = colors.line;
      for (let p = lo; p <= hi; p += 12) {
        const k = keys.get(p);
        if (k) ctx.fillRect(Math.round(k.x), 0, 1, hitY);
      }

      // Falling notes.
      const pxPerSec = hitY / LOOKAHEAD_SEC;
      const lit = new Set<number>();
      for (const n of sorted) {
        if (n.t > now + LOOKAHEAD_SEC) break;
        if (n.t + n.d < now) continue;
        const k = keys.get(n.p);
        if (!k) continue;
        const bottom = Math.min(hitY, hitY - (n.t - now) * pxPerSec);
        const top = hitY - (n.t + n.d - now) * pxPerSec;
        if (n.t <= now) lit.add(n.p);
        ctx.fillStyle = n.p >= RIGHT_HAND_FROM ? colors.ivory : colors.brass;
        ctx.beginPath();
        ctx.roundRect(k.x + 1, top, Math.max(2, k.w - 2), Math.max(3, bottom - top), 2);
        ctx.fill();
      }

      // Bursts for notes that just landed.
      while (spawnFrom < sorted.length && sorted[spawnFrom].t <= now) {
        const n = sorted[spawnFrom++];
        const k = keys.get(n.p);
        if (playing && k && n.t > now - 0.1) pool.current?.burst(k.x + k.w / 2, hitY, 0.7);
      }

      // Hit line.
      ctx.fillStyle = colors.brass;
      ctx.fillRect(0, hitY, width, 1);

      // Keyboard: white keys, then black keys on top, lit keys in the theme color.
      const kbTop = height - KEYBOARD_H;
      for (const [p, k] of keys) {
        if (k.black) continue;
        ctx.fillStyle = lit.has(p) ? colors.key : colors.ivory;
        ctx.globalAlpha = lit.has(p) ? 1 : 0.9;
        ctx.fillRect(k.x + 0.5, kbTop, k.w - 1, KEYBOARD_H);
      }
      ctx.globalAlpha = 1;
      for (const [p, k] of keys) {
        if (!k.black) continue;
        ctx.fillStyle = lit.has(p) ? colors.key : colors.ebony;
        ctx.fillRect(k.x, kbTop, k.w, KEYBOARD_H * 0.62);
      }

      pool.current?.step(dt);
      pool.current?.draw(ctx, token);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      themeObserver.disconnect();
    };
  }, [songId, notes, playing, effectiveTheme]);

  return (
    <div ref={box} className={`absolute inset-0 overflow-hidden rounded-sm ${className}`}>
      <canvas ref={canvas} className="absolute inset-0" role="img" aria-label="Falling notes above a piano keyboard" />
    </div>
  );
}
