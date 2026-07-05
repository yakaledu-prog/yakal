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

// A stable pool of seeds for the pickable avatar gallery.
export const AVATAR_SEEDS: string[] = [
  "Nova", "Aria", "Kai", "Zola", "Milo", "Sena", "Iris", "Dax",
  "Luna", "Finn", "Maya", "Rex", "Gia", "Owen", "Pia", "Tobi",
  "Echo", "Bella", "Cody", "Hana", "Jax", "Quinn", "Wren", "Yuki",
];

/** The gallery as ready-to-render URLs. */
export function avatarGallery(style?: string): { seed: string; url: string }[] {
  return AVATAR_SEEDS.map((seed) => ({ seed, url: dicebearUrl(seed, style) }));
}

/** A deterministic default avatar for a user (used when none is chosen yet). */
export function defaultAvatarFor(key: string): string {
  return dicebearUrl(key || "yakal");
}
