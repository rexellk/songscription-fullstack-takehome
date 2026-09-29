/**
 * Shared control styles, so a chip, a segment, and a rating option look selected the same way
 * everywhere. Selection is carried by a brass border (3:1 against paper) as well as the fill.
 */
export const CHIP_BASE = "rounded-sm border text-ui transition-colors";
export const CHIP_ON = "border-brass bg-brass-soft text-ink";
export const CHIP_OFF = "border-rule text-ink-2 hover:border-rule-strong hover:text-ink";

export const chip = (selected: boolean) => `${CHIP_BASE} ${selected ? CHIP_ON : CHIP_OFF}`;
