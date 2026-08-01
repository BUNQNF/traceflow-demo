# TraceFlow 产研协同工作台

第二期研发智能挑战赛，场景一「H5 智能产研协同流程」的竞赛交付仓库。

公开仓库：[github.com/BUNQNF/traceflow-demo](https://github.com/BUNQNF/traceflow-demo)

TraceFlow 面向 H5 项目中的业务方、产品经理、UI 设计师、前端工程师与验收方，围绕需求提出、需求分析与确认、原型生成、UI 设计、前端开发和验收交付建立可演示闭环。项目以“2027 新年头像工坊 H5”作为完整案例，通过四视图总览、需求对照表、阶段审核、版本留痕和变更协同，让需求、流程原型、视觉交付与运行实现保持关联。

项目使用本地演示数据和浏览器 `localStorage` 保存流程状态。AI 分析、自动审核、外部设计链接和交付资产均使用可解释的内置演示逻辑，不包含真实登录、后端、多人实时协作或外部 AI 调用。

## 赛题对应

场景一要求解决 H5 产研过程中的线下沟通、Excel 台账、资产脱节、变更难追溯和多角色返工问题，并要求覆盖：

- “需求提出 → 需求分析与确认 → 原型生成 → UI 设计 → 前端开发 → 验收交付”的端到端业务闭环；
- 业务方、产品经理、UI 设计师、前端工程师和验收方的职责与操作边界；
- 需求流转、信息同步、审核确认、版本管理及变更追溯；
- 需求与原型、UI、前端实现和验收证据的关联，以及需求变更后的跨视图协同更新；
- 完整产品设计方案和可交互、可演示、可交付的高保真 H5 Demo。

赛题原文与统一考核方案仅保留在本地完整交付包中，不进入公开仓库。

## 在线演示

TraceFlow 同时提供两种演示入口：可直接打开已交付的头像工坊项目查看四视图资产与变更协同，也可从空白表单创建新项目并逐阶段完成交付。

| 快速查看已交付项目 | 从 0 演示完整流程 |
| --- | --- |
| 打开 [TraceFlow 在线 Demo](https://bunqnf.github.io/traceflow-demo/)，展开“从已创建的项目继续”，选择“2027 新年头像工坊 H5” | 打开 [TraceFlow 在线 Demo](https://bunqnf.github.io/traceflow-demo/)，选择“创建项目”，从需求文档或表单开始 |

## 交付清单

考核方案要求以六个维度验收。以下材料均以仓库内可直接打开的 Markdown 文档或 PNG 图片交付。

| 考核维度 | 交付内容 | 直接查看 |
| --- | --- | --- |
| 产品场景分析 | 业务问题、目标用户、项目目标、范围与真实性边界 | [PRD 需求文档](docs/requirements.md) · [交付对照表](docs/delivery-map.md) |
| 产品方案设计 | 功能架构、六阶段主流程、角色规则、双路线 UI 审核和需求变更流转 | [PRD 需求文档](docs/requirements.md) · [流程原型](docs/prototype.md) |
| UX 体验设计 | Figma 页面截图、四视图信息架构、需求对照表、AI 审核和变更协同关键帧 | **Figma 页面截图：** [项目总览](docs/assets/figma-keyframes/01-project-overview.png) · [需求对照表](docs/assets/figma-keyframes/02-requirement-matrix.png) · [AI 分析与审核](docs/assets/figma-keyframes/03-ai-analysis-review.png) · [变更影响与更新计划](docs/assets/figma-keyframes/04-change-impact-plan.png)<br>**设计文档：** [Figma 关键帧](https://www.figma.com/design/XDlIRPtgf6UZxU7gHPSso1) · [视觉说明](docs/visual-spec.md) |
| HTML 交付实现 | 可交互高保真 Demo、源码、本地状态恢复与技术实现说明 | [技术就绪说明](docs/technical-spec.md) · [验收记录](docs/acceptance.md) · [GitHub Pages 在线演示](https://bunqnf.github.io/traceflow-demo/) |
| 交付规范 | 需求、状态、Figma 节点、运行实现和验收证据的可追溯关联 | [交付对照表](docs/delivery-map.md) · [验收记录](docs/acceptance.md) · [GitHub Actions](https://github.com/BUNQNF/traceflow-demo/actions) |
| AI 应用能力 | 自研四视图全栈同步工作流、AI 产研协同方法与创新价值 | [AI 应用与创新亮点：四视图全栈同步工作流](docs/ai-application-innovation.md) |

## 全部文档导航

- [AI 应用与创新亮点：四视图全栈同步工作流](docs/ai-application-innovation.md)
- [PRD 需求文档](docs/requirements.md)
- [流程原型](docs/prototype.md)
- [视觉说明](docs/visual-spec.md)
- [技术就绪说明](docs/technical-spec.md)
- [验收记录](docs/acceptance.md)
- [交付对照表](docs/delivery-map.md)

## 目录说明

```text
src/                         React + TypeScript 高保真 Demo 源码
docs/                        需求、流程、视觉、技术、AI 与验收过程材料
  assets/figma-keyframes/    已确认 Figma 关键帧 PNG
.github/workflows/           GitHub Pages 自动构建与部署配置
```

## 产品与技术说明

- 产品定位：面向 H5 项目需求到交付的轻量化智能产研协同工作台。
- 主交付闭环：创建项目 → 需求分析与确认 → 原型生成 → UI 设计 → 前端开发 → 验收交付。
- 变更闭环：任意阶段发起变更 → AI 影响分析 → 提交申请 → 责任人同意 → 分视图提交更新 → `v1.1` 内容齐备。
- AI 表现：以可解释的本地规则模拟需求结构化、Prompt 生成、变更分类、影响追踪和演示审核；不声称调用真实模型或外部工具。
- 数据边界：所有项目、角色、资产、版本和审计数据均为演示内容，仅保存在评委当前浏览器的 `localStorage` 中。
- 技术栈：React、TypeScript、Vite、Lucide React、原生 CSS 响应式布局。
- 公开部署：GitHub Actions 构建 `dist/`，GitHub Pages 提供 HTTPS 静态网页。

详细可检查材料见 [交付对照表](docs/delivery-map.md) 与 [验收记录](docs/acceptance.md)。

