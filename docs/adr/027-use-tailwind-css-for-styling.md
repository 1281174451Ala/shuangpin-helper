# ADR 027：使用 Tailwind CSS 实现样式

## 状态

已接受

## 背景

项目需要一个样式解决方案来实现双拼辅助键盘的 UI。传统方案包括：
- 手写 CSS 文件，维护自定义类
- CSS-in-JS 库（如 styled-components、emotion）
- UI 框架（如 Material-UI、Ant Design）

考虑到项目的学习性质和 MVP 范围，需要选择一个：
- 学习曲线合理的方案
- 开发效率高的工具
- 易于维护的架构
- 性能优良的方案

## 决策

采用 Tailwind CSS 作为样式解决方案，遵循 utility-first 方法。

**具体做法：**
- 所有组件样式通过 Tailwind utility 类直接定义在 JSX 中
- 全局基础样式使用 `@layer base` 定义
- 使用任意值语法处理自定义颜色和尺寸
- 不维护自定义 CSS 类文件

**依赖项：**
- `tailwindcss` - 核心 CSS 框架
- `postcss` - CSS 处理器
- `autoprefixer` - 自动添加浏览器前缀

## 理由

### 优势

1. **学习价值**：Tailwind CSS 是现代前端开发的主流工具，学习它有助于理解 utility-first CSS 方法
2. **开发效率**：直接在 JSX 中定义样式，减少在 CSS 文件和组件间切换
3. **可维护性**：样式与组件定义在一起，便于理解和重构
4. **性能**：PurgeCSS 自动移除未使用的样式，生产包体积小
5. **一致性**：设计系统内置在配置中，避免不一致的样式值
6. **响应式**：内置响应式前缀，简化多设备适配

### 与传统方案对比

| 方案 | 学习曲线 | 开发速度 | 维护性 | 性能 |
|------|----------|----------|--------|------|
| Tailwind CSS | 中等 | 高 | 高 | 高 |
| 手写 CSS | 低 | 中 | 中 | 高 |
| CSS-in-JS | 高 | 高 | 中 | 中 |
| UI 框架 | 低 | 高 | 低 | 中 |

### 与项目特性匹配

- **MVP 范围**：项目 UI 简单，Tailwind 的 utility 类足够覆盖所有需求
- **学习目的**：作为现代前端技术栈的一部分，Tailwind 值得学习
- **Tauri 集成**：Tailwind 与 Vite、React、Tauri 完全兼容

## 后果

### 正面

- 样式定义更直观，减少上下文切换
- 新样式需求可通过组合现有类快速实现
- 设计系统一致性有保障
- 生产包体积优化自动化

### 负面

- JSX 中的 className 可能较长，需要合理拆分组件
- 团队需要学习 Tailwind 的类名约定
- 某些复杂动画可能需要自定义 CSS

### 风险

- 初期学习曲线可能略微影响开发速度
- 过度使用任意值可能影响设计系统一致性

## 替代方案

### 1. 手写 CSS

**优点**：完全控制，无学习成本
**缺点**：维护成本高，样式分散

### 2. CSS-in-JS

**优点**：样式与组件强关联，动态样式方便
**缺点**：运行时开销，学习成本高

### 3. UI 框架

**优点**：开箱即用，开发最快
**缺点**：定制困难，包体积大

## 实施

1. 安装依赖：`npm install -D tailwindcss@latest @tailwindcss/postcss postcss autoprefixer`
2. 配置 PostCSS：在 `postcss.config.js` 中使用 `@tailwindcss/postcss`
3. 导入 Tailwind：在 `src/styles.css` 中使用 `@import "tailwindcss"`
4. 替换样式：将自定义 CSS 类转换为 Tailwind 类
5. 更新文档：README.md 和 AGENTS.md

**注意：** Tailwind v4 使用 `@import "tailwindcss"` 而不是 v3 的 `@tailwind` 指令。不再需要 `tailwind.config.js` 配置文件。

## 参考

- [Tailwind CSS v4 官方文档](https://tailwindcss.com/)
- [Tailwind v4 升级指南](https://tailwindcss.com/docs/upgrade-guide)
- [Utility-First CSS](https://tailwindcss.com/docs/reusing-styles)
- [Tailwind with Vite](https://tailwindcss.com/docs/guides/vite)