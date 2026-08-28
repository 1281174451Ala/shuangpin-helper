# Issue 跟踪器：GitHub

本仓库的 issue 和 spec 以 GitHub issue 的形式存在。所有操作都使用 `gh` CLI。

## 约定

- **创建 issue**：`gh issue create --title "..." --body "..."`。多行正文用 heredoc。
- **读取 issue**：`gh issue view <number> --comments`，用 `jq` 过滤评论并同时获取标签。
- **列出 issue**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` 并配合适当的 `--label` 和 `--state` 过滤。
- **评论 issue**：`gh issue comment <number> --body "..."`。
- **应用 / 移除标签**：`gh issue edit <number> --add-label "..."` / `gh issue edit <number> --remove-label "..."`。
- **关闭 issue**：`gh issue close <number> --comment "..."`。

从 `git remote -v` 推断仓库；在本仓库克隆内运行时，`gh` 会自动处理。

## 把拉取请求作为分类入口

**把 PR 当作请求入口：否。**

## 当技能说“发布到 issue 跟踪器”

创建一个 GitHub issue。

## 当技能说“获取相关 ticket”

运行 `gh issue view <number> --comments`。

## Wayfinding 操作

- **地图**：一个标记为 `wayfinder:map` 的 issue，承载 Notes、Decisions-so-far 与 Fog 正文。
- **子 ticket**：作为 GitHub 子 issue 链接到地图的 issue；不可用时在地图正文使用任务列表，并在 ticket 顶部标记所属地图。标签使用 `wayfinder:research`、`wayfinder:prototype`、`wayfinder:grilling` 或 `wayfinder:task`。
- **阻塞**：优先使用 GitHub 原生 issue 依赖；不可用时在正文顶部写入 `Blocked by: #<n>, #<n>`。
- **前沿**：选择未关闭、未被阻塞且未认领的地图子项。
- **认领**：`gh issue edit <n> --add-assignee @me`。
- **解决**：先评论结果，再关闭 ticket，并将上下文指针追加到地图的 Decisions-so-far。
