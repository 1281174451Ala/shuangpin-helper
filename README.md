# ShuangPin Helper

macOS-first desktop helper for learning Xiaohe double pinyin. The project uses Tauri 2, React, TypeScript, Tailwind CSS, and Rust.

## Prerequisites

- Node.js 20 or later
- Rust stable with Cargo (required to run the Tauri desktop shell)
- macOS accessibility permissions will be required when global keyboard listening is added

## Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (utility-first CSS framework)
- **Desktop Shell**: Tauri 2 + Rust
- **Testing**: Vitest + @testing-library/react

## Commands

```bash
npm install          # install frontend dependencies
npm test             # run all tests
npm run build        # build frontend for production
npm run tauri dev    # run the desktop app in development mode
npm run tauri build  # create production bundle
```

`npm run tauri dev` starts the Vite frontend and launches the Tauri window. The current scaffold implements a local keyboard-state preview only; native global keyboard listening is intentionally deferred to the MVP feature work.

## Layout

- `src/components/` contains React UI components.
- `src/engine/` contains double-pinyin mapping and input-state rules.
- `config/` contains data-driven input schemes.
- `src-tauri/` contains the native desktop shell and capability configuration.

## Styling with Tailwind CSS

This project uses **Tailwind CSS v4** for styling. Key files:

- `src/styles.css` - Tailwind import and custom base styles
- `postcss.config.js` - PostCSS configuration with `@tailwindcss/postcss`

**Important:** Tailwind v4 uses `@import "tailwindcss"` instead of the v3 `@tailwind` directives. The `tailwind.config.js` file is optional in v4.

All component styles use Tailwind utility classes directly in JSX.
