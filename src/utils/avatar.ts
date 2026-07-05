// DiceBear avatar helpers. The base URL and style are configurable via .env
// so the avatar look can be swapped (or self-hosted) without code changes.

const BASE = (import.meta.env.VITE_DICEBEAR_BASE_URL || "https://api.dicebear.com").replace(/\/$/, "");
const DEFAULT_STYLE = import.meta.env.VITE_DICEBEAR_STYLE || "shapes";

/** Build a DiceBear SVG avatar URL for a given seed. */
export function dicebearUrl(seed: string, style: string = DEFAULT_STYLE): string {
  return `${BASE}/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

/** True if a stored avatar_url points at our DiceBear service (vs. an upload). */
export function isDicebearUrl(url?: string | null): boolean {
  return !!url && url.startsWith(BASE);
}

// Selectable DiceBear styles for the gallery tabs (all real DiceBear 9.x styles).
export interface AvatarStyle {
  id: string;
  label: string;
}
export const AVATAR_STYLES: AvatarStyle[] = [
  { id: "shapes", label: "Shapes" },
  { id: "rings", label: "Rings" },
  { id: "initials", label: "Initials" },
  { id: "icons", label: "Icons" },
  { id: "bottts", label: "Bots" },
  { id: "thumbs", label: "Thumbs" },
];

// A stable pool of seeds for the pickable avatar gallery.
export const AVATAR_SEEDS: string[] = [
  "Nova", "Aria", "Kai", "Zola", "Milo", "Sena", "Iris", "Dax",
  "Luna", "Finn", "Maya", "Rex", "Gia", "Owen", "Pia", "Tobi",
  "Echo", "Bella", "Cody", "Hana", "Jax", "Quinn", "Wren", "Yuki",
];

/** The gallery as ready-to-render URLs for a given style. */
export function avatarGallery(seeds: string[], style?: string): { seed: string; url: string }[] {
  return seeds.map((seed) => ({ seed, url: dicebearUrl(seed, style) }));
}

/** Generate n random seeds (for the shuffle/random button). */
export function randomSeeds(n = 12): string[] {
  return Array.from({ length: n }, () =>
    Math.random().toString(36).slice(2, 9)
  );
}

/** A deterministic default avatar for a user (used when none is chosen yet). */
export function defaultAvatarFor(key: string): string {
  return dicebearUrl(key || "yakal");
}

export type RGB = [number, number, number];
/** Default warm accent (#CAA25F) used before/if extraction fails. */
export const DEFAULT_ACCENT: RGB = [202, 162, 95];

export function rgba([r, g, b]: RGB, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Pull a representative (most vivid) colour out of an avatar image so the UI
 * can tint itself to match. Falls back to DEFAULT_ACCENT on any error (e.g. a
 * CORS-tainted canvas).
 */
export function extractAccentColor(url: string): Promise<RGB> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(DEFAULT_ACCENT);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let best: RGB = DEFAULT_ACCENT;
        let bestSat = -1;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 200) continue;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          if (mx > 245 && mn > 245) continue; // skip near-white
          if (mx < 20) continue;              // skip near-black
          const sat = mx === 0 ? 0 : (mx - mn) / mx;
          if (sat > bestSat) {
            bestSat = sat;
            best = [r, g, b];
          }
        }
        resolve(best);
      } catch {
        resolve(DEFAULT_ACCENT);
      }
    };
    img.onerror = () => resolve(DEFAULT_ACCENT);
    img.src = url;
  });
}
