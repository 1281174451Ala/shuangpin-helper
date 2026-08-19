# 版本发布流程

本文档记录双拼辅助键盘的版本发布操作步骤。

## 发布前检查

1. **运行全量测试**：`npm test` 确认所有单元测试通过
2. **本地构建验证**：`npm run tauri build` 确认产物能正常启动
3. **确认未提交变更**：`git status` 确保无遗漏
4. **确认 CI 通过**：检查 GitHub Actions 的 Test 工作流（`main` 分支最新一次）为绿色

## 发布步骤

只需两步：

### 1. 创建注解 tag

```bash
git tag -a vX.Y.Z -m "vX.Y.Z 发布说明"
```

版本规范遵循语义化版本（SemVer）：
- `X`：不兼容的 API 变更
- `Y`：新增功能，向后兼容
- `Z`：仅修复问题，向后兼容

### 2. 推送到远端

```bash
git push origin main
git push origin vX.Y.Z
```

推送完成后 GitHub Actions 的 Release 工作流会自动完成以下操作：
1. 从 tag 名提取版本号（如 `v0.2.0` → `0.2.0`）
2. 自动更新 `package.json` 和 `src-tauri/tauri.conf.json` 的版本号
3. 跑一遍测试（双保险）
4. 构建 Tauri 应用
5. 基于上次 tag 到本次 tag 之间的 commit 记录自动生成 Release Notes
6. 创建 GitHub Release 页面并上传 `.app` / `.dmg` 产物

可在 [Actions 页面](https://github.com/1281174451Ala/shuangpin-helper/actions) 查看进度。

## CI 工作流说明

### Test 工作流（.github/workflows/test.yml）

- **触发时机**：push / PR 到 `main` 分支
- **执行内容**：`npm test`、`npm run build`、`cargo test`
- **运行环境**：`macos-latest`
- **缓存**：Rust 构建产物 + npm 依赖

### Release 工作流（.github/workflows/release.yml）

- **触发时机**：push `v*` 前缀的 tag
- **运行环境**：`macos-latest`
- **自动化能力**：
  - ✅ 版本号同步：从 tag 提取版本号，自动更新两处配置文件
  - ✅ 测试：`npm test` + `cargo test`
  - ✅ 构建：`tauri build`
  - ✅ Release Notes：基于 `git log` 自动生成上次 tag 以来的 commit 变更列表
  - ✅ 发布：自动创建 GitHub Release 并上传产物
- **签名策略**：未配置签名证书（用户需右键 → 打开绕过 macOS 安全提示）

## 后续可升级方向

- **Apple 开发者证书签名 + 公证**：需要 Apple Developer Program 账号（$99/年），在 GitHub Secrets 中配置 `APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_API_KEY`、`APPLE_API_ISSUER`、`APPLE_API_KEY_PATH`
- **多平台构建**：目前仅构建 macOS，可扩展到 Windows / Linux（需增加对应 runner 和系统依赖安装步骤）
- **Release Notes 格式增强**：目前按 commit 时间顺序列出，可接入 `conventional-changelog` 按 feat/fix/refactor 分类生成