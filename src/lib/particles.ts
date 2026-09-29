import type { PracticeTheme } from "@/types";

/**
 * A fixed pool of particles for the practice stage. No objects are created per frame
 * and nothing touches the DOM, so a dense passage stays at 60fps.
 */

type Shape = "spark" | "ellipse" | "dot" | "square";

export type ThemeConfig = {
  label: string;
  /** Particles per note at full velocity. */
  burst: [number, number];
  speed: [number, number];
  /** Sideways drift range. */
  spread: number;
  /** Positive pulls down, negative lifts. */
  gravity: number;
  life: [number, number];
  size: [number, number];
  shape: Shape;
  spin: boolean;
  twinkle: boolean;
  /** Token names; resolved to colors at draw time so they follow the palette. */
  colors: string[];
  /** Key highlight when a note lands. */
  keyColor: string;
};

export const THEME_ORDER: PracticeTheme[] = ["off", "embers", "petals", "snow", "stardust"];

export const THEMES: Record<PracticeTheme, ThemeConfig> = {
  off: { label: "Off", burst: [0, 0], speed: [0, 0], spread: 0, gravity: 0, life: [0, 0], size: [0, 0], shape: "dot", spin: false, twinkle: false, colors: [], keyColor: "brass" },
  embers: {
    label: "Embers",
    burst: [6, 12],
    speed: [60, 150],
    spread: 40,
    gravity: -40,
    life: [0.5, 1.1],
    size: [1, 2.2],
    shape: "spark",
    spin: false,
    twinkle: true,
    colors: ["brass"],
    keyColor: "brass",
  },
  petals: {
    label: "Petals",
    burst: [4, 8],
    speed: [30, 80],
    spread: 70,
    gravity: -10,
    life: [1.2, 2.2],
    size: [2.5, 4.5],
    shape: "ellipse",
    spin: true,
    twinkle: false,
    colors: ["oxblood", "ivory-note"],
    keyColor: "oxblood",
  },
  snow: {
    label: "Snow",
    burst: [5, 9],
    speed: [15, 45],
    spread: 30,
    gravity: -8,
    life: [1.8, 3],
    size: [1.2, 2.6],
    shape: "dot",
    spin: false,
    twinkle: false,
    colors: ["ivory-note"],
    keyColor: "ivory-note",
  },
  stardust: {
    label: "Stardust",
    burst: [8, 14],
    speed: [40, 120],
    spread: 90,
    gravity: 0,
    life: [0.3, 0.8],
    size: [1, 2],
    shape: "square",
    spin: false,
    twinkle: true,
    colors: ["ivory-note"],
    keyColor: "ivory-note",
  },
};

const MAX = 400;
const MAX_SPAWN_PER_FRAME = 60;

export class ParticlePool {
  private x = new Float32Array(MAX);
  private y = new Float32Array(MAX);
  private vx = new Float32Array(MAX);
  private vy = new Float32Array(MAX);
  private age = new Float32Array(MAX);
  private life = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private rot = new Float32Array(MAX);
  private color = new Uint8Array(MAX);
  private next = 0;
  private spawnedThisFrame = 0;

  constructor(private theme: ThemeConfig) {}

  setTheme(theme: ThemeConfig) {
    this.theme = theme;
    this.life.fill(0);
  }

  /** A burst from where a note meets the keys. Velocity (0..1) scales the burst. */
  burst(x: number, y: number, velocity = 0.7) {
    const t = this.theme;
    if (t.burst[1] === 0) return;
    const count = Math.round(lerp(t.burst[0], t.burst[1], velocity));
    for (let i = 0; i < count && this.spawnedThisFrame < MAX_SPAWN_PER_FRAME; i++) {
      const k = this.next;
      this.next = (this.next + 1) % MAX;
      this.spawnedThisFrame++;
      const speed = lerp(t.speed[0], t.speed[1], Math.random());
      this.x[k] = x + (Math.random() - 0.5) * 6;
      this.y[k] = y;
      this.vx[k] = (Math.random() - 0.5) * t.spread;
      this.vy[k] = -speed;
      this.age[k] = 0;
      this.life[k] = lerp(t.life[0], t.life[1], Math.random());
      this.size[k] = lerp(t.size[0], t.size[1], Math.random());
      this.rot[k] = Math.random() * Math.PI;
      this.color[k] = Math.floor(Math.random() * t.colors.length);
    }
  }

  step(dt: number) {
    this.spawnedThisFrame = 0;
    const g = this.theme.gravity;
    for (let k = 0; k < MAX; k++) {
      if (this.life[k] <= 0) continue;
      this.age[k] += dt;
      if (this.age[k] >= this.life[k]) {
        this.life[k] = 0;
        continue;
      }
      this.vy[k] += g * dt;
      this.x[k] += this.vx[k] * dt;
      this.y[k] += this.vy[k] * dt;
      if (this.theme.spin) this.rot[k] += dt * 2;
    }
  }

  draw(ctx: CanvasRenderingContext2D, resolve: (token: string) => string) {
    const t = this.theme;
    if (t.colors.length === 0) return;
    const colors = t.colors.map(resolve);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < MAX; k++) {
      if (this.life[k] <= 0) continue;
      const p = this.age[k] / this.life[k];
      let alpha = 1 - p;
      if (t.twinkle) alpha *= 0.6 + 0.4 * Math.sin(this.age[k] * 30 + k);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = colors[this.color[k]];
      const s = this.size[k];
      const x = this.x[k];
      const y = this.y[k];
      if (t.shape === "square") {
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      } else if (t.shape === "spark") {
        ctx.fillRect(x - s / 2, y - s * 1.5, s, s * 3);
      } else {
        ctx.beginPath();
        if (t.shape === "ellipse") ctx.ellipse(x, y, s, s * 0.55, this.rot[k], 0, Math.PI * 2);
        else ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
