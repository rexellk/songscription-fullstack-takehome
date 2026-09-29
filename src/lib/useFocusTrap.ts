"use client";

import { useCallback, useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** What Tab actually visits: visible, not a guard, and only one stop per radio group. */
function tabbables(root: HTMLElement) {
  const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (n) => !n.hasAttribute("data-focus-guard") && n.getClientRects().length > 0,
  );
  return all.filter((n) => {
    if (!(n instanceof HTMLInputElement) || n.type !== "radio" || !n.name) return true;
    const group = all.filter((m): m is HTMLInputElement => m instanceof HTMLInputElement && m.name === n.name);
    const checked = group.find((m) => m.checked);
    return checked ? n === checked : n === group[0];
  });
}

/**
 * Moves focus into `container` when it becomes active and keeps Tab inside it, using
 * guard elements at each end (render them with the returned props). Returning focus
 * afterwards is the caller's job: it knows what opened the container.
 */
export function useFocusTrap(container: RefObject<HTMLElement | null>, active: boolean, initial?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (active) (initial?.current ?? container.current)?.focus({ preventScroll: true });
  }, [active, container, initial]);

  const wrapTo = useCallback(
    (end: "first" | "last") => {
      const el = container.current;
      if (!el) return;
      const items = tabbables(el);
      (end === "first" ? items[0] : items[items.length - 1])?.focus();
    },
    [container],
  );

  const guard = (end: "first" | "last") => ({
    tabIndex: active ? 0 : -1,
    "data-focus-guard": true,
    "aria-hidden": true,
    onFocus: () => wrapTo(end),
  });

  return { startGuard: guard("last"), endGuard: guard("first") };
}
