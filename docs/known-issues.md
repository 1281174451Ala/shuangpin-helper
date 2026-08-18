# 已知问题

本文件记录尚未修复的已知问题，供后续排查与修复参考。

## BUG-001：窗口内按键监听疑似重复触发，高亮一闪即逝

### 现象

在未启动全局监听（`isListening` 为 false）时，于应用窗口内按键，候选键的高亮样式仅出现一瞬间便回到默认状态，无法稳定停留在"等待第二键"状态。

### 怀疑原因

`src/App.tsx` 中存在两个独立的按键处理路径：

1. 第一个 `useEffect` 订阅 Tauri 后端的 `key-event` 事件（Rust 全局监听），回调中调用 `setInputState((s) => transition(s, inputEvent))`。
2. 第二个 `useEffect` 在 `!isListening` 时注册 `window.addEventListener("keydown")`，回调中同样调用 `setInputState((s) => transition(s, inputEvent))`。

两条路径可能对同一次按键各触发一次状态转移：第一次将状态推进到"等待第二键"（高亮候选），第二次立即将其重置或推进，导致高亮一闪即逝。需要进一步确认两条路径是否在同一条件下同时生效，以及 `transition` 在连续两次相同输入下的行为。

### 复现条件

- 未授予辅助功能权限或未点击"开始监听"，`isListening` 为 false。
- 在应用窗口内按下字母键。

### 临时规避

暂无。优先使用全局监听模式（授予辅助功能权限并启动监听）。

### 状态

待修复。
