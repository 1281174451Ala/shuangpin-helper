# 已知问题

本文件记录尚未修复的已知问题，供后续排查与修复参考。

## BUG-001：窗口内按键监听重复触发，高亮一闪即逝（已修复）

### 现象

启动全局监听时，于应用窗口内按键，候选键的高亮样式仅出现一瞬间便回到默认状态，无法稳定停留在"等待第二键"状态。

### 根本原因

Rust 后端在 `src-tauri/src/lib.rs` 的 `setup` 阶段自动调用 `key_listener::start_listening`（见 ADR 023），即应用启动时若已获得辅助功能权限，全局监听便已运行。

但前端 `src/App.tsx` 的 `isListening` 状态初始值为 `false`，且仅当用户手动点击"启动全局监听"按钮时才设为 `true`。这导致：

1. Rust 全局监听已启动，按键通过 `key-event` 事件触发第一次状态转移（idle → waitingSecondKey，高亮候选键出现）。
2. 前端 `isListening` 仍为 `false`，第二个 `useEffect` 注册了 `window.addEventListener("keydown")`，同一按键触发第二次状态转移（waitingSecondKey → idle，高亮消失）。

状态机 `transition` 在 `waitingSecondKey` 状态下收到任意 `letter` 事件会直接返回 `{ phase: "idle" }`，因此第二次触发使高亮一闪即逝。

### 修复方案

在 `src/App.tsx` 初始化 `useEffect` 的 `setup` 函数中，权限检查后调用 `invoke<boolean>("get_listener_status")` 查询后端实际监听状态，并据此设置 `isListening`。当 Rust 已自动启动监听时，前端 `isListening` 同步为 `true`，第二个 `useEffect` 不再注册 `window.addEventListener("keydown")`，消除重复触发。

### 复现条件

- 启动全局监听。
- 在应用窗口内按下字母键。

### 状态

已修复。提交：`fix: sync isListening with backend on init to prevent double key trigger`。
