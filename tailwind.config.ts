import type { Config } from "tailwindcss";

// Colors, radii, and shadows replace Tailwind's defaults instead of extending them.
// That makes the design rules enforceable: there is no `bg-purple-500`, `rounded-2xl`,
// or `shadow-lg` to reach for, only the semantic tokens defined in globals.css.
const token = (name: string) => `var(--${name})`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      paper: {
        DEFAULT: token("paper"),
        raised: token("paper-raised"),
        sunk: token("paper-sunk"),
      },
      lane: token("lane"),
      rule: {
        DEFAULT: token("rule"),
        strong: token("rule-strong"),
      },
      ink: {
        DEFAULT: token("ink"),
        2: token("ink-2"),
        3: token("ink-3"),
      },
      brass: {
        DEFAULT: token("brass"),
        soft: token("brass-soft"),
      },
      "on-brass": token("on-brass"),
      ebony: {
        DEFAULT: token("ebony"),
        line: token("ebony-line"),
      },
      "ivory-note": token("ivory-note"),
      oxblood: token("oxblood"),
      scrim: token("scrim"),
    },
    borderRadius: {
      none: "0",
      sm: "3px",
      DEFAULT: "4px",
      md: "4px",
      lg: "6px",
      full: "9999px",
    },
    boxShadow: {
      none: "none",
    },
    extend: {
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
      },
      fontSize: {
        display: ["44px", { lineHeight: "1.05", letterSpacing: "-0.015em" }],
        "display-sm": ["34px", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        drawer: ["30px", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        section: ["22px", { lineHeight: "1.25" }],
        "card-title": ["19px", { lineHeight: "1.3" }],
        body: ["15px", { lineHeight: "1.55" }],
        ui: ["14px", { lineHeight: "1.45" }],
        meta: ["12px", { lineHeight: "1.4" }],
      },
      maxWidth: {
        page: "1200px",
      },
      transitionTimingFunction: {
        drawer: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        skeleton: "pulse 1.2s ease-in-out infinite",
        "fade-in": "fade-in 180ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
