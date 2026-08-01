# TraceFlow 技术就绪说明

## 1. 实现边界

- **运行形态：** 单页 Web Demo，构建为纯静态网站后托管到 CloudBase 或 GitHub Pages；评委不需要安装软件、登录或连接后端即可用浏览器打开。
- **技术栈：** Vite + React + TypeScript + 原生 CSS；Lucide React 仅用于熟悉的操作图标。
- **理由：** 当前工作区没有既有代码；该组合可快速完成复杂交互、细粒度视觉实现、离线演示和直接状态预览，依赖面最小。
- **视觉实现：** 以 `docs/visual-spec.md` 的 v2.1 为基线。冷灰画布、两层 CSS 模糊弥散光、柔和状态卡和小面积渐变主操作均由 CSS 实现，不使用背景图片。
- **交付策略：** CloudBase 为主地址，GitHub Pages 为备用地址。两者均只托管构建后的静态文件；不上传真实业务数据、账号或密钥。

## 2. 运行结构

```text
src/
|-- app/
|   |-- App.tsx                 # hash 路由、全局工作台壳层、角色切换
|   |-- routes.ts                # 可直达状态与 query 参数解析
|   `-- demo-state.ts            # 初始快照、重置和 localStorage 恢复
|-- domain/
|   |-- types.ts                 # 需求、资产、版本、审计、角色、任务模型
|   |-- reducer.ts               # 显式命令与状态转移守卫
|   `-- selectors.ts             # 四视图、影响范围、覆盖率和待办派生数据
|-- features/
|   |-- overview/                # TF-01
|   |-- requirements/            # TF-02A 至 TF-02D
|   |-- assets/                  # TF-03 至 TF-05
|   |-- acceptance/              # TF-06
|   `-- changes/                 # TF-07A 至 TF-07D
|-- components/                  # AppShell、StatusTag、AssetLink、ReviewFooter 等
|-- styles/                      # tokens.css、app.css、responsive.css
`-- main.tsx
```

## 3. 状态与本地数据

### 3.1 存储

- 本地键：`traceflow.workflow.v1`。
- 初始状态：无项目；创建项目后依次保存原始输入、`REQ-*` 需求对照、`P-*`、`D-*`、`FE-*`、`AC-*` 及审计记录。
- 写入时机：只在成功的领域命令后写入，例如确认基线、批准审核、创建/确认变更、验收、回退或重置。
- 重置：先弹出二次确认，再删除本地键并恢复初始快照；不访问网络。

### 3.2 核心实体

| 实体 | 最少字段 | 约束 |
| --- | --- | --- |
| `Requirement` | `id`、标题、摘要、优先级、状态、版本、流程依据、视觉依据、前端/验收关联 ID | AI 分析后生成草稿；基线确认后不可原地覆盖，并作为变更影响计算的来源。 |
| `Asset` | `id`、类型、来源 ID、版本、状态、责任角色 | 只可沿来源链路创建；变更仅标记受影响项。 |
| `WorkflowState` | 当前阶段、各阶段生成状态、`implementationRoute`、上传文件名和验收勾选 | `implementationRoute` 仅允许 `hifi-prototype` 或 `actual-page`；由 UI 审核出口写入并决定下一阶段标题、来源和交付物。 |
| `ChangeRequest` | `id`、标题、说明、发起角色、发起阶段、来源/目标版本、AI 类型与摘要、状态、角色任务、提交时间 | 项目创建后任意阶段均可建立；修改 AI 输入会清除旧任务；申请提交前不得通知责任人或修改主交付状态。 |
| `ChangeTask` | `id`、四视图、责任角色、关联 `REQ-*`、资产、理由、应交付内容、同意/提交状态、提交说明、附件名 | 状态只允许 `waiting -> pending-approval -> approved -> submitted`；未同意不得开放提交，空内容不得提交。 |
| `VersionSnapshot` | `id`、来源版本、对象快照、当前标记 | `v1.0` 与 `v1.1` 同时保留；回退只切换当前标记。 |
| `AuditEvent` | 操作者角色、时间、对象、前后状态、版本 | 每个影响版本或交付的命令追加一条。 |

### 3.3 领域命令与守卫

`SUBMIT_REQUIREMENT`、`RUN_AI_ANALYSIS`、`CONFIRM_BASELINE`、`CONFIRM_PROTOTYPE`、`REVIEW_UI_KEYFRAMES`、`REVIEW_UI_ALL`、`REVIEW_IMPLEMENTATION`、`COMPLETE_ACCEPTANCE`、`CREATE_CHANGE`、`ANALYZE_IMPACT`、`CONFIRM_UPDATE_PLAN`、`ROLLBACK_VERSION`、`RESET_DEMO`。

- Reducer 是唯一可修改领域状态的入口。
- 命令先检查固定角色、前序阶段、必填驳回原因和版本冲突；失败时只更新界面反馈，不写入业务状态。
- AI 命令只返回确定性建议；`?scenario=ai-fail` 进入失败态，保留原始输入与编辑稿。
- `RUN_AI_ANALYSIS` 同时建立结构化 `REQ-*` 对照草稿；`CONFIRM_BASELINE` 冻结需求与关联占位。后续阶段从状态机派生“待创建/待确认/已确认/已通过”，`ANALYZE_IMPACT` 必须查询该关系图，不维护另一份脱节的影响清单。
- `REVIEW_UI_KEYFRAMES` 只确认 `D-01` 并写入 `implementationRoute=hifi-prototype`；`REVIEW_UI_ALL` 确认 `D-01` 至 `D-03` 并写入 `implementationRoute=actual-page`。两条命令均进入实现阶段，但不得共享含糊的审核记录。

## 4. 路由与可复现预览

不增加路由库，使用浏览器原生 hash 与查询参数，保证比赛现场可复制地址直达状态。

Hash 地址还避免静态托管平台的“刷新子页面 404”问题：无论打开哪个状态，平台只需返回同一个 `index.html`，浏览器再决定展示哪个页面。

| 目标 | 地址示例 | 说明 |
| --- | --- | --- |
| 项目总览 | `#/overview` | `TF-01` 默认页。 |
| 需求对照表 | `#/requirements` | `TF-02A`，可下钻需求。 |
| AI 分析 | `#/requirements/REQ-004?step=analysis` | `TF-02C`。 |
| AI 失败 | `#/requirements/REQ-004?step=analysis&scenario=ai-fail` | 保留输入并显示重试。 |
| 关联角色审核 | `#/requirements/REQ-004?step=confirm` | `TF-02D`；Demo 中由需求方自动审核并显示演示提示。 |
| 原型/UI/实现/验收 | `#/assets?stage=prototype|ui|frontend|acceptance` | `TF-03` 至 `TF-06`。 |
| 变更申请/编辑 | `#/changes/CR-001?step=draft` | `TF-07A`；实际 Demo 使用本地页面状态，不依赖服务端路由。 |
| 影响分析/角色流转 | `#/changes/CR-001?step=impact|tasks` | `TF-07B` 至 `TF-07D`；AI 分析、提交申请、角色同意和内容提交均在变更协同页完成。 |

## 5. T5/T6 实现切分

| 单元 | 阶段 | 范围 | 通过证据 |
| --- | --- | --- | --- |
| U1 工作台与视觉令牌 | T5 | `AppShell`、导航、角色切换、冷灰弥散底、响应式壳层 | `1440/1024/768/375` 截图无溢出。 |
| U2 总览与需求对照表 | T5 | `TF-01`、`TF-02A` 的静态数据、资产链路和详情面板 | 与 VF-01/VF-02 视觉比对。 |
| U3 AI 与确认审阅 | T5 | `TF-02C/D` 的静态编辑、依据、确认栏及失败视觉 | 与 VF-03 比对。 |
| U4 变更影响与计划 | T5 | `TF-07B/C` 的静态版本、影响卡、任务队列 | 与 VF-04 比对。 |
| U5 项目创建与需求基线 | T6 | 无项目空状态、文档上传/表单录入、六项校验、AI 分析、确认/驳回与本地审计 | 两种创建入口汇合到待确认需求；刷新恢复；确认后仅解锁原型。 |
| U6 资产审核、交付物查看与验收 | T6 | 原型、UI、前端、验收的顺序守卫和驳回；方案资产的本地附件预览与演示资料说明 | 越级操作被阻止，驳回可恢复；本地附件可预览，模拟资料始终保留来源提示。 |
| U7 `CR-001` 与版本 | T6 | 任意阶段发起、AI 关联分析、五项角色任务、同意后编辑提交、`v1.1` 内容齐备、审计与重置 | 刷新恢复；未同意与空内容守卫有效；主交付阶段和 `v1.0` 不被变更协同覆盖。正式发布与回退在后续验收链路继续处理。 |

## 6. 验证方案与风险

- **构建：** `npm run build` 必须通过；不依赖网络数据。
- **部署：** 将构建产物 `dist/` 上传至 CloudBase 静态托管，并以 GitHub Pages 保存同一版本备用地址；部署前后均不得注入密钥或环境私密信息。
- **访问：** 使用全新无痕窗口、未登录浏览器和另一台设备分别打开公开地址；首屏、四个关键入口、刷新恢复和重置均须可用。
- **视觉：** 在 `1440`、`1024`、`768`、`375` 截图对照四个已确认关键帧；小屏按视觉说明转为抽屉和列表详情。
- **行为：** 每个 T2 动作均验证“操作 -> 即时反馈 -> 本地状态/审计变化 -> 刷新恢复”。
- **权限：** 以固定 Demo 角色覆盖业务方、产品经理、UI、前端、验收；越权主动作隐藏或说明责任人。
- **演示可靠性：** 所有数据、AI 响应、失败分支和时间线均内置；页面提供重置入口。数据只在评委当前浏览器保存，不会在不同电脑间共享，这是刻意的比赛 Demo 边界。
- **当前风险：** T3 关键帧只冻结视觉，不覆盖所有 T1/T2 的具体功能。U2 至 U7 的验收必须以 `requirements.md` 和 `prototype.md` 为功能真相，不能因视觉稿缺少内容而省略状态。

## 7. T4 结论

实现不需要后端或外部授权，工程可直接开始 T5。构建产物可以直接发布到 CloudBase 或 GitHub Pages；在网络可访问该托管平台、且使用现代浏览器的前提下，评委可从任意电脑打开体验。唯一强制前置是：实施每个静态单元时，先对照对应的 `REQ-*`、`TF-*` 与已确认视觉规则，补齐关键帧尚未呈现的功能内容。
