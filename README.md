# Yakal

Marketing site for Yakal, personalized tutoring for students who want to excel
in Math, Science, and SAT prep.

Built with React, TypeScript, Vite, and Tailwind CSS.

## Getting started

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run the TypeScript compiler with no emit |

## Structure

```
src/
  app/         App shell (page state + scroll restoration)
  pages/       Home, Subject, and Blog pages
  sections/    Home-page sections (Hero, About, Blog, ...)
  components/  Reusable UI (Navbar, Reveal, ...)
  data/        Subjects and blog content
  assets/      Images
  styles/      Global and theme CSS
```

## Deployment

Configured for [Vercel](https://vercel.com) (see `vercel.json`). Vercel
auto-detects the Vite preset; the SPA rewrite keeps deep links working.
