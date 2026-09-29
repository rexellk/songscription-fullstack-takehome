"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/components/PracticeStage";
import { ParticlePool, THEMES, THEME_ORDER } from "@/lib/particles";
import type { PracticeTheme } from "@/types";

type Props = {
  name: string;
  value: PracticeTheme | null;
  onChange: (theme: PracticeTheme | null) => void;
  /** Adds a "Default" choice (null) for per-song overrides. */
  defaultTheme?: PracticeTheme;
  tone?: "paper" | "ebony";
};

function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}

/** A tiny looping preview of a theme on an ebony swatch: one key landing every second. */
function Swatch({ theme, animate }: { theme: PracticeTheme; animate: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = 44;
    const h = 30;
    el.width = w * dpr;
    el.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pool = new ParticlePool(THEMES[theme]);
    const keyColor = token(THEMES[theme].keyColor);
    let frame = 0;
    let last = performance.now();
    let nextBurst = 0;
    const draw = (ts: number) => {
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      nextBurst -= dt;
      if (animate && nextBurst <= 0) {
        pool.burst(w / 2, h - 8, 1);
        nextBurst = 1;
      }
      ctx.fillStyle = token("ebony");
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = keyColor;
      ctx.fillRect(w / 2 - 5, h - 8, 10, 8);
      pool.step(dt);
      pool.draw(ctx, token);
      if (animate) frame = requestAnimationFrame(draw);
    };
    if (!animate) {
      // A still frame that still shows the theme: one burst, caught just after it starts.
      pool.burst(w / 2, h - 8, 1);
      pool.step(0.08);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [theme, animate]);
  return <canvas ref={canvas} className="h-[30px] w-11 rounded-sm" aria-hidden />;
}

/** Practice themes as small swatches with real radio inputs, so keyboard and screen readers work. */
export function ThemePicker({ name, value, onChange, defaultTheme, tone = "paper" }: Props) {
  const reduced = useReducedMotion();
  const options: { value: PracticeTheme | null; label: string }[] = [
    ...(defaultTheme ? [{ value: null, label: `Default (${THEMES[defaultTheme].label})` }] : []),
    ...THEME_ORDER.map((t) => ({ value: t, label: THEMES[t].label })),
  ];
  const text = tone === "ebony" ? "text-ivory-note" : "text-ink-2";
  return (
    <div>
    <div className={`grid gap-1 ${defaultTheme ? "grid-cols-6" : "grid-cols-5"}`}>
      {options.map((o) => {
        const checked = value === o.value;
        const shown = o.value ?? defaultTheme ?? "embers";
        return (
          <label key={String(o.value)} className="relative flex flex-col items-center gap-1">
            <input
              type="radio"
              name={name}
              checked={checked}
              onChange={() => onChange(o.value)}
              className="peer absolute inset-0 cursor-pointer opacity-0"
            />
            <span
              className={`rounded border p-0.5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brass ${
                checked ? "border-brass" : "border-rule"
              }`}
            >
              <Swatch theme={shown} animate={checked && !reduced} />
            </span>
            <span className={`text-center text-meta leading-tight ${checked ? (tone === "ebony" ? "text-ivory-note" : "text-ink") : text}`}>{o.label}</span>
          </label>
        );
      })}
    </div>
      {reduced && (
        <p className={`mt-2 text-meta ${tone === "ebony" ? "text-[color-mix(in_srgb,var(--ivory-note)_70%,transparent)]" : "text-ink-3"}`} role="note">
          Particles are off because Reduce motion is on in your system settings.
        </p>
      )}
    </div>
  );
}
