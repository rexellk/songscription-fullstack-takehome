"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { HAND_OPTIONS, SPEED_OPTIONS, speedLabel, usePracticeDefaults } from "@/lib/preferences";
import { track } from "@/lib/track";
import { SHORT_HAND } from "@/components/PracticeSettings";
import { Segmented } from "@/components/Segmented";
import type { PracticeHand } from "@/types";

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;


/**
 * Library-wide settings, behind the avatar: how the app looks and how practice
 * starts by default. Per-song overrides live in each song's drawer.
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [defaults, setDefaults] = usePracticeDefaults();
  const [mounted, setMounted] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("input:checked")?.focus();
    const onPointer = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Settings for Rexell"
        className="flex h-10 w-10 items-center justify-center rounded-full"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper-sunk font-mono text-meta text-ink-2 transition-colors hover:text-ink">
          RX
        </span>
      </button>

      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Settings"
          className="absolute right-0 top-12 z-30 w-[288px] animate-fade-in rounded border border-rule-strong bg-paper-raised p-4"
        >
          <p className="text-ui font-medium text-ink">Rexell</p>
          <p className="font-mono text-meta text-ink-3">Demo account</p>

          <div className="mt-4">
            <Segmented
              legend="Appearance"
              name="theme"
              value={mounted ? (theme as (typeof THEMES)[number]["value"]) : null}
              options={THEMES.map((t) => ({ value: t.value, label: t.label }))}
              onChange={(v) => {
                if (!v) return;
                setTheme(v);
                track("theme_changed", { mode: v });
              }}
            />
          </div>

          <div className="mt-5 border-t border-rule pt-4">
            <p className="text-ui text-ink">Practice defaults</p>
            <p className="mt-1 text-meta text-ink-3">Used for every song unless you change them for that song.</p>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <Segmented
              legend="Speed"
              name="default-speed"
              value={mounted ? defaults.speed : null}
              options={SPEED_OPTIONS.map((s) => ({ value: s, label: speedLabel(s) }))}
              onChange={(v) => {
                if (v == null) return;
                setDefaults({ speed: v });
                track("practice_settings_changed", { scope: "library", setting: "speed", value: v });
              }}
            />
            <Segmented<PracticeHand>
              legend="Hands"
              name="default-hand"
              value={mounted ? defaults.hand : null}
              options={HAND_OPTIONS.map((h) => ({ value: h, label: SHORT_HAND[h] }))}
              onChange={(v) => {
                if (!v) return;
                setDefaults({ hand: v });
                track("practice_settings_changed", { scope: "library", setting: "hand", value: v });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
