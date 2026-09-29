/** Files in public/samples, in the order the demo library adds them. See public/samples/CREDITS.md. */
export const SAMPLE_FILES = [
  "beethoven-fur-elise.mid",
  "twinkle-twinkle.mid",
  "c-major-scale.mid",
  "bach-minuet-in-a-minor.mid",
  "burgmuller-arabesque.mid",
  "chopin-prelude-in-e-minor.mid",
  "chopin-prelude-in-a-major.mid",
  "chopin-raindrop-prelude.mid",
  "debussy-clair-de-lune.mid",
  "debussy-first-arabesque.mid",
  "joplin-maple-leaf-rag.mid",
] as const;

/** "Try a sample" adds one recognizable, medium-length piece: enough notes for a real piano roll. */
export const FIRST_SAMPLE = "beethoven-fur-elise.mid";
