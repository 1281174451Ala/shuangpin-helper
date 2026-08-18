# ShuangPin Helper 双拼学习助手

一款 macOS 桌面小工具，帮助你在日常打字中练习[小鹤双拼](https://flypy.com)键位。它在后台全局监听按键，并在虚拟键盘上高亮显示当前按键与下一键的候选字母，让你一边正常输入一边建立肌肉记忆。

基于 Tauri 2、React、TypeScript、Tailwind CSS 与 Rust 构建。

## 功能特性

- **小鹤双拼映射引擎** —— 方案数据驱动（`config/shuangpin.json`），覆盖声母、韵母、零声母与合法组合规则。
- **全局按键监听** —— 需 macOS 辅助功能权限,全局监听按键，高亮显示可选韵母。
- **菜单栏常驻** —— 托盘图标与菜单，提供"检查辅助功能权限"入口与打开系统设置的快捷方式，可随时显示/隐藏键盘悬浮窗。
- **应用内退出** —— 悬浮键盘上的退出按键，可直接关闭应用。

## 环境要求

- macOS（已在近期版本开发与测试）
- Node.js 20 或更高版本
- Rust stable（含 Cargo，用于运行 Tauri 桌面外壳）
- macOS 辅助功能权限（系统设置 → 隐私与安全性 → 辅助功能），首次启动时会申请

## 技术栈

- **前端**：React 19 + TypeScript + Vite
- **样式**：Tailwind CSS v4（utility-first CSS 框架）
- **桌面外壳**：Tauri 2 + Rust
- **测试**：Vitest + @testing-library/react

## 常用命令

```bash
npm install          # 安装前端依赖
npm test             # 运行全部测试
npm run build        # 构建生产版本前端
npm run tauri dev    # 以开发模式运行桌面应用
npm run tauri build  # 打包生产版本
```

`npm run tauri dev` 会启动 Vite 前端并打开 Tauri 窗口。本工具是只读的：它不会修改或注入文本到其他应用，仅可视化按键。

## 目录结构

- `src/components/`：React UI 组件。
- `src/engine/`：双拼映射与输入状态规则。
- `config/`：数据驱动的输入方案。
- `src-tauri/`：原生桌面外壳与权限配置。
- `docs/`：PRD、ADR、术语表与设计文档（中文）。




## 许可证

本项目基于 [MIT License](LICENSE) 开源。
