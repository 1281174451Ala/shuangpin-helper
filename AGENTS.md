# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains the product requirements in `prd.md`; implementation has not yet been scaffolded. Build the macOS MVP with Tauri 2, React + TypeScript, and Rust.

Keep frontend code under `src/`: `components/` for UI, `engine/` for mappings and state logic, and `store/` for shared state. Keep Tauri and macOS-facing Rust code under `src-tauri/`, and scheme data in `config/` (for example, `config/shuangpin.json`). Keep UI, input-state logic, and native code separate.

## Build, Test, and Development Commands

No package manifest or build tooling exists yet. When scaffolding Tauri, document the commands in `README.md` and use generated package scripts. Expected commands include:

- `npm install` — install frontend dependencies.
- `npm run tauri dev` — run the desktop app locally.
- `npm run tauri build` — create a production bundle.
- `cargo test --manifest-path src-tauri/Cargo.toml` — run Rust tests.

Run commands from the repository root. Do not commit generated `dist/`, `target/`, or platform build artifacts.

## Coding Style & Naming Conventions

Use TypeScript for frontend code and Rust for native functionality. Prefer 2-space indentation in TypeScript/JSON and `rustfmt` defaults in Rust. Name React components with PascalCase (`VirtualKeyboard.tsx`), functions and variables with camelCase, Rust items with `snake_case`, and configuration files with lowercase kebab-case where applicable.

Use explicit types at public boundaries. Add short JSDoc to every TypeScript function and every field in `interface`/`type` definitions. Add a concise trailing comment to React Hook declarations and a preceding comment for each `useEffect`. Keep double-pinyin mappings data-driven rather than hard-coded into UI components.

## Testing Guidelines

Add focused unit tests for shuangpin mappings, valid initial/final combinations, zero-initial rules, and state transitions. Name tests by behavior, such as `stateMachine.test.ts` or `filters invalid second keys`. Add Rust tests for native event conversion and window behavior. Test macOS permission-dependent keyboard listening manually before release.

## Commit & Pull Request Guidelines

There is no Git history yet, so use concise imperative commits such as `feat: add xiaohe mapping engine` or `fix: reset state after second key`. Keep commits scoped. Pull requests should describe the user-visible behavior, link the relevant requirement or issue, list tests run, and include screenshots or a short recording for keyboard/window UI changes. Flag any macOS permissions, accessibility, or startup-item changes explicitly.
