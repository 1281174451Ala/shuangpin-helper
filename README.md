# ShuangPin Helper

macOS-first desktop helper for learning Xiaohe double pinyin. The project uses Tauri 2, React, TypeScript, and Rust.

## Prerequisites

- Node.js 20 or later
- Rust stable with Cargo (required to run the Tauri desktop shell)
- macOS accessibility permissions will be required when global keyboard listening is added

## Commands

```bash
npm install
npm test
npm run build
npm run tauri dev
```

`npm run tauri dev` starts the Vite frontend and launches the Tauri window. The current scaffold implements a local keyboard-state preview only; native global keyboard listening is intentionally deferred to the MVP feature work.

## Layout

- `src/components/` contains React UI components.
- `src/engine/` contains double-pinyin mapping and input-state rules.
- `config/` contains data-driven input schemes.
- `src-tauri/` contains the native desktop shell and capability configuration.
