export type Page =
  | { type: "home"; scrollY?: number }
  | { type: "subject"; name: string; img: string; scrollY: number }
  | { type: "blog"; slug: string; scrollY: number };
