import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  ClipboardCheck,
  ClipboardList,
  Copy,
  ExternalLink,
  FileCode2,
  FileText,
  Folders,
  GitBranch,
  Image,
  LayoutDashboard,
  Link,
  LoaderCircle,
  Menu,
  Package,
  PenLine,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UsersRound,
  WandSparkles,
  Workflow,
  X,
} from "lucide-react";

type WorkflowStage = "requirement" | "prototype" | "visual" | "frontend" | "acceptance" | "delivered";
type DeliveryStage = "prototype" | "visual" | "frontend";
type Page = "overview" | "requirements" | "assets" | "analysis" | DeliveryStage | "acceptance" | "changes" | "audit";
type AssetView = "requirements" | "prototype" | "visual" | "runtime";
type SourceMode = "upload" | "form";
type ImplementationRoute = "hifi-prototype" | "actual-page";
type ChangeRequestStatus = "draft" | "analyzing" | "analysis-ready" | "pending-approval" | "in-progress" | "completed";
type ChangeTaskStatus = "waiting" | "pending-approval" | "approved" | "submitted";
type ChangeView = AssetView;
type ChangeRole = "业务方" | "产品经理" | "UI 设计师" | "前端工程师" | "验收方";

type ProjectInput = {
  name: string;
  background: string;
  timeline: string;
  requirement: string;
  coreGoal: string;
  dataGoal: string;
  sourceMode: SourceMode;
  sourceFileName?: string;
};

type AnalysisDraft = {
  userStory: string;
  functions: string;
  acceptance: string;
  risks: string;
  questions: string;
};

type RequirementRow = {
  id: string;
  title: string;
  summary: string;
  priority: "P0" | "P1";
  flowBasis: string;
  visualBasis: string;
  frontend: string;
  acceptance: string;
};

type AuditEntry = {
  id: string;
  action: string;
  detail: string;
  role: string;
  time: string;
};

type ChangeTask = {
  id: string;
  view: ChangeView;
  viewLabel: string;
  owner: ChangeRole;
  asset: string;
  requirementIds: string[];
  reason: string;
  deliverable: string;
  status: ChangeTaskStatus;
  submission: string;
  fileName?: string;
};

type ChangeRequest = {
  id: string;
  title: string;
  description: string;
  initiator: ChangeRole;
  status: ChangeRequestStatus;
  changeType?: string;
  impactLevel?: string;
  analysisSummary?: string;
  baseVersion: string;
  targetVersion: string;
  stageAtCreation: WorkflowStage;
  tasks: ChangeTask[];
  createdAt: string;
  submittedAt?: string;
  completedAt?: string;
};

type WorkflowState = {
  project: ProjectInput;
  stage: WorkflowStage;
  analysisStatus: "idle" | "running" | "ready";
  analysis: AnalysisDraft;
  requirements: RequirementRow[];
  generated: Record<DeliveryStage, boolean>;
  implementationRoute?: ImplementationRoute;
  uploads?: Partial<Record<DeliveryStage, string[]>>;
  acceptanceChecks: string[];
  changeRequest?: ChangeRequest;
  audit: AuditEntry[];
};

type StageOutput = { id: string; title: string; type: string; description: string; primary?: boolean };

type AssetRecord = {
  id: string;
  title: string;
  format: string;
  source: string;
  simulated?: boolean;
  version: string;
  owner: string;
  relations: string;
  description: string;
  action: string;
};

const STORAGE_KEY = "traceflow.workflow.v1";
const stageOrder: WorkflowStage[] = ["requirement", "prototype", "visual", "frontend", "acceptance", "delivered"];
const stageLabels: Record<WorkflowStage, string> = {
  requirement: "需求确认",
  prototype: "原型生成",
  visual: "UI 设计",
  frontend: "前端开发",
  acceptance: "验收交付",
  delivered: "已交付",
};

const navItems = [
  { id: "overview" as const, label: "项目总览", icon: LayoutDashboard },
  { id: "requirements" as const, label: "需求中心", icon: ClipboardList },
  { id: "assets" as const, label: "方案资产", icon: Folders },
  { id: "changes" as const, label: "变更协同", icon: FileCode2 },
];

const deliveryNav: { id: DeliveryStage | "acceptance"; label: string; icon: typeof Workflow; stage: WorkflowStage }[] = [
  { id: "prototype", label: "原型生成", icon: Workflow, stage: "prototype" },
  { id: "visual", label: "UI 设计", icon: Image, stage: "visual" },
  { id: "frontend", label: "前端开发", icon: FileCode2, stage: "frontend" },
  { id: "acceptance", label: "验收交付", icon: ClipboardCheck, stage: "acceptance" },
];

const stageOutputs: Record<DeliveryStage, StageOutput[]> = {
  prototype: [
    { id: "prototype.md", title: "AI 流程原型总文档", type: "Markdown · 主要产出", description: "汇总核心路径及带状态 ID 的页面与状态表，记录进入条件、动作、反馈、数据变化和离开条件。", primary: true },
    { id: "P-02", title: "产品功能架构图", type: "结构图", description: "将需求拆分为入口、核心任务、结果与管理模块。" },
    { id: "P-03", title: "主流程与交互图", type: "Mermaid", description: "补充页面跳转、确认节点、异常与返回路径。" },
  ],
  visual: [
    { id: "D-01", title: "核心页面关键帧", type: "设计稿", description: "覆盖入口、主任务、结果和记录四个关键状态。" },
    { id: "D-02", title: "组件与视觉规范", type: "设计规范", description: "定义布局、颜色、文字、状态和可复用组件。" },
    { id: "D-03", title: "切图、标注与交付链接", type: "协作链接", description: "向前端交付尺寸、间距、资源和交互标注。" },
  ],
  frontend: [
    { id: "FE-01", title: "响应式页面壳层", type: "前端模块", description: "实现桌面与移动端导航、页面结构和基础状态。" },
    { id: "FE-02", title: "核心业务交互", type: "前端模块", description: "实现主要任务、输入校验、即时反馈和异常恢复。" },
    { id: "FE-03", title: "高保真体验地址", type: "H5 预览", description: "提供可验收的交互版本及版本说明。" },
  ],
};

const hifiPrototypeOutputs: StageOutput[] = [
  { id: "FE-01", title: "高保真页面还原", type: "H5 原型", description: "依据已审核关键帧还原核心页面、布局、视觉层级和移动端适配。" },
  { id: "FE-02", title: "核心状态与交互", type: "交互模块", description: "实现主路径、页面切换、即时反馈及关键加载与异常状态。" },
  { id: "FE-03", title: "可交互原型地址", type: "H5 预览", description: "提供用于业务、产品和开发共同评审的高保真可交互版本。" },
];

function outputsFor(kind: DeliveryStage, route?: ImplementationRoute) {
  return kind === "frontend" && route === "hifi-prototype" ? hifiPrototypeOutputs : stageOutputs[kind];
}

const acceptanceItems = [
  { id: "coverage", label: "需求覆盖", detail: "已确认需求均有具体流程依据、视觉依据和前端实现。" },
  { id: "main-flow", label: "核心流程", detail: "主任务可从入口完整走到结果页面。" },
  { id: "mobile", label: "移动端可用性", detail: "375px 基线无横向溢出或不可触达操作。" },
  { id: "recovery", label: "异常与恢复", detail: "校验失败、生成失败和返回路径均有明确反馈。" },
  { id: "release", label: "发布资料", detail: "验收报告、体验地址和发布包信息已齐备。" },
];

const fullAssetRecords: Record<AssetView, AssetRecord[]> = {
  requirements: [
    { id: "REQ-DOC-01", title: "PRD · 项目需求基线", format: "Markdown 文档", source: "本地附件", version: "v1.0", owner: "产品经理", relations: "REQ-001 ~ REQ-009", description: "活动背景、目标、功能、验收规则和数据目标的完整需求基线。", action: "打开文档" },
    { id: "REQ-LIST-01", title: "功能清单与验收映射", format: "XLSX · 演示附件", source: "演示模拟", simulated: true, version: "v1.0", owner: "产品 · 验收", relations: "REQ -> FE -> AC", description: "将需求映射到功能模块、验收点和责任角色。", action: "预览表格" },
    { id: "PLAN-01", title: "活动方案与推进计划", format: "DOCX · 演示附件", source: "演示模拟", simulated: true, version: "v1.0", owner: "运营方", relations: "活动目标 · 时间轴", description: "包含活动目标、用户路径、素材主题与发布节奏。", action: "查看方案" },
    { id: "REVIEW-01", title: "需求评审与基线确认", format: "协作纪要 · 演示链接", source: "演示模拟", simulated: true, version: "v1.0", owner: "运营 · 产品", relations: "PRD · 决策记录", description: "记录 AI 建议经业务、产品确认后建立基线的结论。", action: "打开纪要" },
  ],
  prototype: [
    { id: "prototype.md", title: "AI 流程原型总文档", format: "Markdown 文档", source: "本地附件", version: "v1.0", owner: "产品经理", relations: "REQ-001 ~ REQ-009 -> AVATAR-*", description: "流程主依据；汇总核心路径以及带状态 ID 的页面、加载、异常与恢复状态表。", action: "打开原型" },
    { id: "P-02", title: "产品功能架构图", format: "FigJam · 演示链接", source: "演示模拟", simulated: true, version: "v1.0", owner: "产品经理", relations: "REQ-001 ~ REQ-009", description: "从需求到核心功能模块的结构与交接关系。", action: "打开架构图" },
    { id: "P-03", title: "主路径 Mermaid 流程图", format: "Mermaid 图 · 本地文档", source: "本地附件", version: "v1.0", owner: "产品经理", relations: "入口 -> 任务 -> 结果", description: "展示核心任务及审核节点之间的状态转换。", action: "查看流程" },
    { id: "P-LINK-01", title: "低保真可点击原型", format: "H5 · 演示链接", source: "演示模拟", simulated: true, version: "v1.0", owner: "产品经理", relations: "关键状态 · 异常状态", description: "用于产品、设计和研发共同确认页面结构与反馈。", action: "打开原型" },
  ],
  visual: [
    { id: "D-01", title: "视觉设计说明", format: "Markdown 文档", source: "本地附件", version: "v1.0", owner: "UI 设计师", relations: "核心页面 · 组件", description: "记录画布、安全区、组件规则与主视觉素材边界。", action: "打开规范" },
    { id: "D-02", title: "关键帧与组件规范", format: "HTML / PNG 附件", source: "本地附件", version: "v1.0", owner: "UI 设计师", relations: "入口 · 主任务 · 结果", description: "主要状态的高保真关键帧及可复用组件说明。", action: "预览关键帧" },
    { id: "D-03", title: "Figma 设计交付文件", format: "Figma · 演示链接", source: "演示模拟", simulated: true, version: "v1.0", owner: "UI 设计师", relations: "页面 · 组件 · 标注", description: "设计页面、组件和标注集合，供产品审核和研发查看。", action: "打开 Figma" },
    { id: "D-04", title: "蓝湖切图与标注", format: "蓝湖 · 演示链接", source: "演示模拟", simulated: true, version: "v1.0", owner: "UI · 前端", relations: "切图 · 标注 · 尺寸", description: "导出图层、间距、颜色和图片资源的研发交接入口。", action: "打开蓝湖" },
  ],
  runtime: [
    { id: "FE-01", title: "高保真可交互原型", format: "H5 · 演示链接", source: "演示模拟", simulated: true, version: "v1.0", owner: "前端工程师", relations: "主路径 · 即时反馈", description: "供运营、产品与验收体验核心任务的交互版本。", action: "打开体验" },
    { id: "FE-02", title: "研发协作工作区", format: "协作链接 · 演示", source: "演示模拟", simulated: true, version: "v1.0", owner: "前端 · 产品", relations: "任务 · 评审 · 缺陷", description: "同步开发任务、实现评审和修复记录的协作空间。", action: "打开协作" },
    { id: "AC-01", title: "验收报告与用例记录", format: "PDF · 演示附件", source: "演示模拟", simulated: true, version: "v1.0", owner: "验收方", relations: "需求覆盖 · 回归用例", description: "覆盖主流程、异常恢复与移动端可用性的验收结论。", action: "查看报告" },
    { id: "STAGE-01", title: "预发布体验地址", format: "HTTPS · 演示链接", source: "演示模拟", simulated: true, version: "v1.0-rc.2", owner: "前端工程师", relations: "验收回归", description: "用于验收回归的候选版本地址。", action: "打开地址" },
    { id: "RELEASE-01", title: "正式 H5 与发布包", format: "HTTPS / ZIP · 演示", source: "演示模拟", simulated: true, version: "v1.0", owner: "发布负责人", relations: "发布说明 · 回退点", description: "最终体验地址、发布说明与可回退的版本包。", action: "查看发布" },
  ],
};

function nowLabel() {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function audit(action: string, detail: string, role: string): AuditEntry {
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, action, detail, role, time: nowLabel() };
}

function loadState(): WorkflowState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkflowState;
    const shouldRestoreMappings = parsed.analysisStatus === "ready" || getStageIndex(parsed.stage) > 0;
    const storedRequirements = parsed.requirements ?? (shouldRestoreMappings ? buildRequirementRows(parsed.project) : []);
    return {
      ...parsed,
      requirements: storedRequirements.map((item) => ({
        ...item,
        flowBasis: flowBasisFor(item, parsed.project),
        visualBasis: visualBasisFor(item, parsed.project),
      })),
      uploads: parsed.uploads ?? {},
    };
  } catch {
    return null;
  }
}

function isAvatarWorkshop(project: ProjectInput) {
  return /头像工坊|头像|贴纸|滤镜/.test(`${project.name} ${project.requirement}`);
}

function getAvatarWorkshopProject(sourceMode: SourceMode = "form"): ProjectInput {
  return {
    name: "2027 新年头像工坊 H5",
    background: "春节期间用户有更换社交头像的需求，希望通过轻量 H5 快速完成头像装饰与保存。",
    timeline: "12 月 10 日需求确认；12 月 18 日设计交付；12 月 26 日完成开发；1 月 1 日上线。",
    requirement: "支持预设或上传头像、1:1 裁剪、主题模板、边框贴纸滤镜、圆方切换、PNG 生成保存和本地作品集。",
    coreGoal: "让用户在移动端三分钟内完成一张具有新年氛围的头像并保存。",
    dataGoal: "1. 计划新增下载量 600+。\n2. 拉长日均使用时长 3-5 分钟。\n3. 计划社群新增 200 人。",
    sourceMode,
    sourceFileName: sourceMode === "upload" ? "新年头像工坊-初始需求.md" : undefined,
  };
}

const avatarStatesByRequirement: Record<string, string[]> = {
  "REQ-001": ["AVATAR-01", "AVATAR-03"],
  "REQ-002": ["AVATAR-01", "AVATAR-L01", "AVATAR-02", "AVATAR-E01"],
  "REQ-003": ["AVATAR-03"],
  "REQ-004": ["AVATAR-03"],
  "REQ-005": ["AVATAR-03"],
  "REQ-006": ["AVATAR-L02", "AVATAR-05", "AVATAR-E02"],
  "REQ-007": ["AVATAR-04", "AVATAR-L02", "AVATAR-05", "AVATAR-06", "AVATAR-E02", "AVATAR-E03"],
  "REQ-008": ["AVATAR-06", "AVATAR-07"],
  "REQ-009": ["AVATAR-01", "AVATAR-02", "AVATAR-03", "AVATAR-04", "AVATAR-05", "AVATAR-06", "AVATAR-07", "AVATAR-L01", "AVATAR-L02", "AVATAR-E01", "AVATAR-E02", "AVATAR-E03"],
};

function inferredFlowStates(item: Pick<RequirementRow, "title" | "summary">) {
  const copy = `${item.title} ${item.summary}`;
  const states = ["FLOW-01"];
  if (/输入|上传|创建|表单|入口/.test(copy)) states.push("FLOW-02");
  if (/生成|处理|过程|反馈|结果|保存/.test(copy)) states.push("FLOW-03");
  if (/移动端|失败|恢复|异常|删除/.test(copy)) states.push("FLOW-E01");
  return [...new Set(states)];
}

function statesForRequirement(item: Pick<RequirementRow, "id" | "title" | "summary">, project: ProjectInput) {
  if (isAvatarWorkshop(project) && avatarStatesByRequirement[item.id]) return avatarStatesByRequirement[item.id];
  return inferredFlowStates(item);
}

function flowBasisFor(item: Pick<RequirementRow, "id" | "title" | "summary">, project: ProjectInput) {
  return `prototype.md: ${statesForRequirement(item, project).join("、")}`;
}

function visualBasisFor(item: Pick<RequirementRow, "id" | "title" | "summary">, project: ProjectInput) {
  const states = statesForRequirement(item, project);
  return `visual-spec.md: ${states.join("、")}`;
}

function buildRequirementRows(project: ProjectInput): RequirementRow[] {
  if (isAvatarWorkshop(project)) {
    const rows = [
      { id: "REQ-001", title: "预设头像与本地上传", summary: "支持选择预设头像，或从本地相册上传头像素材。", priority: "P0" as const, frontend: "FE-01", acceptance: "AC-01" },
      { id: "REQ-002", title: "上传压缩与 1:1 裁剪", summary: "上传后自动压缩，并提供 1:1 裁剪与位置调整。", priority: "P0" as const, frontend: "FE-02", acceptance: "AC-02" },
      { id: "REQ-003", title: "主题模板组合替换", summary: "提供多套新年主题模板，并支持快速预览和替换。", priority: "P0" as const, frontend: "FE-03", acceptance: "AC-03" },
      { id: "REQ-004", title: "边框、贴纸与滤镜单类覆盖", summary: "同类装饰只保留当前选择，避免样式重复叠加。", priority: "P0" as const, frontend: "FE-03", acceptance: "AC-03" },
      { id: "REQ-005", title: "圆形与方形头像切换", summary: "用户可切换头像形状，并即时预览最终裁切效果。", priority: "P0" as const, frontend: "FE-03", acceptance: "AC-03" },
      { id: "REQ-006", title: "生成 PNG 与保存", summary: "合成最终头像并生成 PNG，支持移动端保存。", priority: "P0" as const, frontend: "FE-05", acceptance: "AC-04" },
      { id: "REQ-007", title: "本地作品集与容量管理", summary: "保存生成记录，并在达到容量上限时给出明确提示。", priority: "P0" as const, frontend: "FE-06", acceptance: "AC-05" },
      { id: "REQ-008", title: "删除本地作品", summary: "支持删除单个本地作品，并同步释放存储空间。", priority: "P1" as const, frontend: "FE-06", acceptance: "AC-06" },
      { id: "REQ-009", title: "移动端可用性基线", summary: "核心流程适配主流移动端，并覆盖触控、长标题和保存反馈。", priority: "P0" as const, frontend: "FE-01~06", acceptance: "AC-07" },
    ];
    return rows.map((item) => ({ ...item, flowBasis: flowBasisFor(item, project), visualBasis: visualBasisFor(item, project) }));
  }
  const rows = [
    { id: "REQ-001", title: "核心活动任务", summary: project.requirement, priority: "P0" as const, frontend: "FE-01", acceptance: "AC-01" },
    { id: "REQ-002", title: "过程反馈与结果交付", summary: "为核心任务提供即时反馈，并让用户获得可保存或回看的结果。", priority: "P0" as const, frontend: "FE-02", acceptance: "AC-02" },
    { id: "REQ-003", title: "数据目标与统计口径", summary: project.dataGoal, priority: "P0" as const, frontend: "FE-03", acceptance: "AC-03" },
    { id: "REQ-004", title: "移动端可用性基线", summary: "核心流程在 375px 视口下可操作、可恢复且无横向溢出。", priority: "P1" as const, frontend: "FE-01~03", acceptance: "AC-04" },
  ];
  return rows.map((item) => ({ ...item, flowBasis: flowBasisFor(item, project), visualBasis: visualBasisFor(item, project) }));
}

function createChangeDraft(state: WorkflowState): ChangeRequest {
  const delivered = state.stage === "delivered";
  return {
    id: "CR-001",
    title: "",
    description: "",
    initiator: "业务方",
    status: "draft",
    baseVersion: delivered ? "v1.0 已交付" : `${stageLabels[state.stage]}工作版本`,
    targetVersion: delivered ? "v1.1 变更草案" : "当前版本增量",
    stageAtCreation: state.stage,
    tasks: [],
    createdAt: nowLabel(),
  };
}

function getChangeType(description: string) {
  if (/下线|删除|移除|取消/.test(description)) return "范围缩减";
  if (/修复|异常|错误|失败|缺陷/.test(description)) return "缺陷修复";
  if (/新增|增加|支持|扩展|变体/.test(description)) return "功能增强";
  if (/调整|修改|优化|替换/.test(description)) return "需求调整";
  return "需求补充";
}

function getAffectedRequirements(description: string, requirements: RequirementRow[]) {
  if (requirements.length === 0) return [];
  const rules: Array<[RegExp, string[]]> = [
    [/主题|模板|颜色|色彩|配色|变体/, ["REQ-003"]],
    [/边框|贴纸|滤镜|装饰/, ["REQ-004"]],
    [/圆形|方形|形状/, ["REQ-005"]],
    [/生成|PNG|下载|保存/, ["REQ-006"]],
    [/作品集|容量|记录/, ["REQ-007"]],
    [/删除作品|删除记录/, ["REQ-008"]],
    [/移动端|适配|触控|长标题/, ["REQ-009"]],
    [/上传|裁剪|压缩|预设头像/, ["REQ-001", "REQ-002"]],
  ];
  const matchedIds = rules.filter(([pattern]) => pattern.test(description)).flatMap(([, ids]) => ids);
  const matched = requirements.filter((item) => matchedIds.includes(item.id));
  if (matched.length > 0) return matched;
  return [requirements.find((item) => item.priority === "P0") ?? requirements[0]];
}

function buildChangeTasks(state: WorkflowState, description: string): ChangeTask[] {
  const affected = getAffectedRequirements(description, state.requirements);
  const requirementIds = affected.length > 0 ? affected.map((item) => item.id) : [state.project.sourceFileName || "FORM-REQ-01"];
  const first = affected[0];
  const flowAsset = first ? affected.map((item) => item.flowBasis).join("；") : "prototype.md · 待生成";
  const visualAsset = first ? affected.map((item) => item.visualBasis).join("；") : "visual-spec.md · 待生成";
  const frontendAsset = first ? [...new Set(affected.map((item) => item.frontend))].join("、") : "前端实现 · 待生成";
  const acceptanceAsset = first ? [...new Set(affected.map((item) => item.acceptance))].join("、") : "验收用例 · 待生成";
  const currentStage = getStageIndex(state.stage);
  const availability = (target: WorkflowStage) => currentStage >= getStageIndex(target) ? "已有资产需要同步更新" : "资产尚未生成，需纳入后续交付";
  return [
    {
      id: "CHG-REQ-01",
      view: "requirements",
      viewLabel: "需求视图",
      owner: "产品经理",
      asset: `${requirementIds.join("、")} · PRD / 功能清单`,
      requirementIds,
      reason: `变更首先命中需求对照表，需要补充范围、验收标准与版本说明；${availability("requirement")}。`,
      deliverable: "更新需求条目、PRD 与活动方案，并确认新的验收口径。",
      status: "waiting",
      submission: "",
    },
    {
      id: "CHG-PROT-01",
      view: "prototype",
      viewLabel: "流程原型",
      owner: "产品经理",
      asset: flowAsset,
      requirementIds,
      reason: `需求对照表沿流程依据定位到对应页面与状态；${availability("prototype")}。`,
      deliverable: "更新 prototype.md 中的页面状态、进入条件、操作与反馈。",
      status: "waiting",
      submission: "",
    },
    {
      id: "CHG-UI-01",
      view: "visual",
      viewLabel: "视觉视图",
      owner: "UI 设计师",
      asset: visualAsset,
      requirementIds,
      reason: `流程状态映射到对应关键帧、组件规范和设计交付；${availability("visual")}。`,
      deliverable: "提交更新后的关键帧、组件状态、切图与标注说明。",
      status: "waiting",
      submission: "",
    },
    {
      id: "CHG-FE-01",
      view: "runtime",
      viewLabel: "运行视图",
      owner: "前端工程师",
      asset: frontendAsset,
      requirementIds,
      reason: `视觉依据继续关联到实现模块，需同步交互逻辑与预览版本；${availability("frontend")}。`,
      deliverable: "提交实现说明、代码版本与可体验地址。",
      status: "waiting",
      submission: "",
    },
    {
      id: "CHG-AC-01",
      view: "runtime",
      viewLabel: "运行视图 · 验收",
      owner: "验收方",
      asset: acceptanceAsset,
      requirementIds,
      reason: `受影响实现需要新增或调整对应验收用例；${availability("acceptance")}。`,
      deliverable: "提交变更验收用例、覆盖结果与回归结论。",
      status: "waiting",
      submission: "",
    },
  ];
}

const changeStatusLabels: Record<ChangeRequestStatus, string> = {
  draft: "草稿",
  analyzing: "AI 分析中",
  "analysis-ready": "待提交申请",
  "pending-approval": "待角色同意",
  "in-progress": "协同更新中",
  completed: "变更内容已齐备",
};

const changeExampleSubmissions: Record<string, string> = {
  "CHG-REQ-01": "已在 REQ-003 中补充主题模板自定义色彩变体、默认色回退规则和对应验收标准。",
  "CHG-PROT-01": "已在 prototype.md 的 AVATAR-03 下补充颜色选择、实时预览、确认与恢复默认色状态。",
  "CHG-UI-01": "已更新 AVATAR-03 关键帧与颜色选择组件规范，并补充切图、色值和交互标注。",
  "CHG-FE-01": "已完成 FE-03 色彩变体控件、实时预览与默认色恢复逻辑，预览版本为 v1.1-rc.1。",
  "CHG-AC-01": "已更新 AC-03，覆盖选色、预览、确认、恢复默认色及移动端触控回归，结果通过。",
};

function createCompletedAvatarState(): WorkflowState {
  const project = getAvatarWorkshopProject();
  return {
    project,
    stage: "delivered",
    analysisStatus: "ready",
    analysis: {
      userStory: "作为有新年换头像需求的移动端用户，我希望选择或上传头像并快速完成裁剪、装饰、生成和保存。",
      functions: "1. 预设头像与本地上传\n2. 1:1 裁剪与模板装饰\n3. 圆方头像预览与 PNG 保存\n4. 本地作品集管理",
      acceptance: "9 条需求均关联到 prototype.md 的具体状态，并有对应视觉依据、前端实现和验收用例；移动端主路径、保存与本地作品管理通过验收。",
      risks: "移动端图片兼容、画布导出和本地容量为重点验收项。",
      questions: "业务目标、活动时间轴和发布范围均已确认。",
    },
    requirements: buildRequirementRows(project),
    generated: { prototype: true, visual: true, frontend: true },
    implementationRoute: "actual-page",
    acceptanceChecks: acceptanceItems.map((item) => item.id),
    audit: [
      audit("创建项目", "2027 新年头像工坊 H5 已创建。", "业务方"),
      audit("确认需求基线 v1.0", "9 条需求及跨阶段关联已冻结。", "业务方 · 产品经理"),
      audit("原型与 UI 已确认", "原型和视觉交付物已完成审核。", "产品经理 · UI 设计师"),
      audit("前端实现已确认", "高保真 H5 实现已完成审核。", "前端工程师 · 产品经理"),
      audit("验收通过并交付 v1.0", "所有必验项通过，正式体验地址与发布记录已建立。", "验收方 · 发布负责人"),
    ],
  };
}

function getStageIndex(stage: WorkflowStage) {
  return stageOrder.indexOf(stage);
}

function EmptyProject({ onCreate, onOpenProject }: { onCreate: () => void; onOpenProject: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return <main className="empty-project-shell">
    <div className="glow glow-blue" /><div className="glow glow-pink" />
    <header className="empty-brand"><div className="brand-mark"><Sparkles size={17} /></div><div><strong>TraceFlow</strong><small>产研协同工作台</small></div></header>
    <section className={`empty-project-panel ${pickerOpen ? "picker-open" : ""}`}>
      <div className="empty-project-icon"><Folders size={28} /></div>
      <div className="project-continue">
        <button className={`continue-project-trigger ${pickerOpen ? "open" : ""}`} onClick={() => setPickerOpen((current) => !current)} aria-expanded={pickerOpen} aria-controls="existing-project-picker"><Folders size={17} /><span>从已创建的项目继续</span><ChevronDown size={17} /></button>
        {pickerOpen && <div className="existing-project-picker" id="existing-project-picker">
          <label htmlFor="existing-project">选择项目</label>
          <select id="existing-project" defaultValue="avatar-workshop">
            <option value="avatar-workshop">2027 新年头像工坊 H5</option>
          </select>
          <div className="existing-project-meta"><span className="status success">已交付 · v1.0</span><small>9 条需求 · 完整四视图资产</small></div>
          <button className="gradient-button open-project" onClick={onOpenProject}>打开项目 <ChevronRight size={16} /></button>
        </div>}
      </div>
      <div className="empty-create-divider"><span>或</span></div>
      <h1>从一份需求开始</h1>
      <p>创建项目后，需求、原型、UI、前端与验收资产会沿同一条交付链路逐步建立。</p>
      <button className="gradient-button create-first" onClick={onCreate}><Plus size={18} />创建项目</button>
    </section>
  </main>;
}

const blankProject: ProjectInput = {
  name: "",
  background: "",
  timeline: "",
  requirement: "",
  coreGoal: "",
  dataGoal: "",
  sourceMode: "form",
};

function CreateProject({ onBack, onCreate }: { onBack: () => void; onCreate: (project: ProjectInput) => void }) {
  const [mode, setMode] = useState<SourceMode>("form");
  const [form, setForm] = useState<ProjectInput>(blankProject);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [extracting, setExtracting] = useState(false);

  const setField = (field: keyof ProjectInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validateField = (field: keyof ProjectInput) => {
    if (field === "sourceFileName" || field === "sourceMode") return;
    if (!String(form[field] ?? "").trim()) setErrors((current) => ({ ...current, [field]: "此项为必填，请补充后继续。" }));
  };

  const loadExample = () => {
    setForm(getAvatarWorkshopProject(mode));
    setErrors({});
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setExtracting(true);
    const isText = file.type.startsWith("text/") || /\.(md|txt)$/i.test(file.name);
    let content = "";
    if (isText) {
      try { content = (await file.text()).trim().slice(0, 1600); } catch { content = ""; }
    }
    const baseName = file.name.replace(/\.[^.]+$/, "");
    setTimeout(() => {
      setForm((current) => ({
        ...current,
        name: current.name || baseName,
        background: current.background || `项目需求来源于上传文件《${file.name}》，需由产品经理完成结构化分析与业务确认。`,
        timeline: current.timeline || "需求确认后依次完成原型、UI、前端开发与验收交付。",
        requirement: content || `已接收《${file.name}》作为初始需求文档，原文将在需求视图中保留并参与后续分析。`,
        coreGoal: current.coreGoal || "将初始业务需求转化为可设计、可开发、可验收的产品方案。",
        dataGoal: current.dataGoal || "核心需求覆盖率 100%，必验用例通过率 100%。",
        sourceMode: "upload",
        sourceFileName: file.name,
      }));
      setErrors({});
      setExtracting(false);
    }, 550);
  };

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    (["name", "background", "timeline", "requirement", "coreGoal", "dataGoal"] as (keyof ProjectInput)[]).forEach((field) => {
      if (!String(form[field] ?? "").trim()) nextErrors[field] = "此项为必填，请补充后继续。";
    });
    if (mode === "upload" && !form.sourceFileName) nextErrors.sourceFileName = "请先上传一份需求文档。";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setTimeout(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(), 0);
      return;
    }
    onCreate({ ...form, sourceMode: mode });
  };

  const field = (key: keyof ProjectInput, label: string, multiline = false, wide = false) => <label className={`project-field ${wide ? "wide" : ""}`}>
    <span>{label} <b>*</b></span>
    {multiline
      ? <textarea value={String(form[key] ?? "")} onChange={(event) => setField(key, event.target.value)} onBlur={() => validateField(key)} aria-invalid={Boolean(errors[key])} />
      : <input value={String(form[key] ?? "")} onChange={(event) => setField(key, event.target.value)} onBlur={() => validateField(key)} aria-invalid={Boolean(errors[key])} />}
    {errors[key] && <small role="alert">{errors[key]}</small>}
  </label>;

  return <main className="create-project-page">
    <header className="create-header"><button className="icon-button" onClick={onBack} aria-label="返回空项目页"><ChevronLeft size={19} /></button><div className="brand-mark"><Sparkles size={16} /></div><div><strong>创建项目</strong><small>建立第一份可追溯需求</small></div></header>
    <section className="create-workspace">
      <div className="create-copy"><span className="status info">步骤 1 / 6</span><h1>录入项目与初始需求</h1><p>上传文档或直接填写表单。两种方式都会生成一份待确认的结构化需求。</p></div>
      <div className="creation-card">
        <div className="segmented" aria-label="需求录入方式">
          <button className={mode === "upload" ? "selected" : ""} onClick={() => { setMode("upload"); setForm((current) => ({ ...current, sourceMode: "upload" })); }}><Upload size={16} />上传需求文档</button>
          <button className={mode === "form" ? "selected" : ""} onClick={() => { setMode("form"); setForm((current) => ({ ...current, sourceMode: "form" })); }}><FileText size={16} />填写需求表单</button>
        </div>
        {mode === "upload" && <div className="upload-section">
          <label className={`upload-zone ${form.sourceFileName ? "has-file" : ""}`}>
            <input type="file" accept=".md,.txt,.doc,.docx,.pdf,text/plain,text/markdown" onChange={(event) => void handleFile(event.target.files?.[0])} />
            {extracting ? <LoaderCircle className="spin" size={24} /> : form.sourceFileName ? <CheckCircle2 size={24} /> : <Upload size={24} />}
            <strong>{extracting ? "正在提取需求内容" : form.sourceFileName || "选择需求文档"}</strong>
            <small>支持 MD、TXT、DOC、DOCX、PDF；演示中使用确定性本地提取。</small>
          </label>
          {errors.sourceFileName && <p className="field-error" role="alert">{errors.sourceFileName}</p>}
        </div>}
        <div className="form-head"><div><h2>{mode === "upload" ? "核对提取结果" : "项目基本信息"}</h2><p>进入需求分析前，六项信息必须完整。</p></div><button className="text-action" onClick={loadExample}>载入头像工坊示例</button></div>
        <div className="project-form-grid">
          {field("name", "项目名称", false, true)}
          {field("background", "活动背景", true)}
          {field("timeline", "活动时间轴", true)}
          {field("requirement", "需求描述", true, true)}
          {field("coreGoal", "核心目标", true)}
          {field("dataGoal", "数据目标", true)}
        </div>
        <footer className="creation-footer"><p>创建后进入项目总览，需求视图为“确认中”。</p><button className="gradient-button" onClick={submit} disabled={extracting}>创建并进入总览 <ChevronRight size={17} /></button></footer>
      </div>
    </section>
  </main>;
}

function Sidebar({ page, state, open, onNavigate, onClose }: { page: Page; state: WorkflowState; open: boolean; onNavigate: (page: Page) => void; onClose: () => void }) {
  const currentIndex = getStageIndex(state.stage);
  const role = page === "visual" ? "UI 设计师" : page === "frontend" ? "前端工程师" : page === "acceptance" ? "验收方" : "产品经理";
  return <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="主导航">
    <div className="brand"><div className="brand-mark"><Sparkles size={15} /></div><div><strong>TraceFlow</strong><small>协同工作台</small></div><button className="mobile-close" onClick={onClose} aria-label="关闭导航"><X size={18} /></button></div>
    <p className="nav-heading">我的工作</p>
    <nav>{navItems.map((item) => {
      const Icon = item.icon;
      return <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)} title={item.label}><Icon size={17} /><span>{item.label}</span>{item.id === "changes" && state.changeRequest && <span className="nav-change-dot" aria-label="存在需求变更" />}</button>;
    })}</nav>
    <p className="nav-heading records">交付流程</p>
    <nav>{deliveryNav.map((item) => {
      const Icon = item.icon;
      const enabled = currentIndex >= getStageIndex(item.stage);
      return <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => enabled && onNavigate(item.id)} disabled={!enabled} title={enabled ? item.label : `等待${stageLabels[stageOrder[Math.max(0, getStageIndex(item.stage) - 1)]]}`}><Icon size={17} /><span>{item.label}</span>{enabled && currentIndex > getStageIndex(item.stage) && <Check size={13} />}</button>;
    })}</nav>
    <p className="nav-heading records">记录</p><button className={`nav-item ${page === "audit" ? "active" : ""}`} onClick={() => onNavigate("audit")}><Settings size={17} /><span>版本与审计</span></button>
    <div className="profile"><div className="profile-avatar">{role.slice(0, 1)}</div><div><strong>演示角色</strong><small>{role}</small></div><ChevronRight size={16} /></div>
  </aside>;
}

function Topbar({ page, state, onMenu }: { page: Page; state: WorkflowState; onMenu: () => void }) {
  const frontendCopy: [string, string] = state.implementationRoute === "hifi-prototype"
    ? ["高保真原型制作", "依据已审核关键帧制作可交互、可评审的 H5 原型。"]
    : ["实际页面制作", "依据已审核的完整 UI 交付实现可验收的 H5 页面。"];
  const copy: Record<Page, [string, string]> = {
    overview: ["项目总览", `${state.project.name} 的协同快照`],
    requirements: ["需求对照表", "查看原始输入、分析结果、基线和关联资产。"],
    assets: ["方案资产", "从四视图浏览需求、流程、设计和运行交付物。"],
    analysis: ["需求分析与确认", "AI 提供可编辑建议；人工确认后才建立版本基线。"],
    prototype: ["原型生成与确认", "将已确认需求转化为页面、流程和交互说明。"],
    visual: ["UI 设计与审核", "将原型转化为关键帧、组件规范和设计交付。"],
    frontend: frontendCopy,
    acceptance: ["验收与交付", "按需求覆盖检查用例，形成发布证据。"],
    changes: ["变更协同", "集中处理变更申请、AI 影响分析、角色同意与更新交付。"],
    audit: ["版本与审计", "查看每次确认、交接与交付记录。"],
  };
  return <header className="topbar"><button className="menu-button" onClick={onMenu} aria-label="打开导航"><Menu size={20} /></button><div><h1>{copy[page][0]}</h1><p>{copy[page][1]}</p></div><div className="top-actions"><label className="search"><Search size={16} /><input aria-label="搜索需求、资产或版本" placeholder="搜索需求、资产或版本" /></label><button className="icon-button" aria-label="通知"><Bell size={18} /></button></div></header>;
}

function FlowStrip({ stage }: { stage: WorkflowStage }) {
  const current = getStageIndex(stage);
  return <div className="flow-strip" aria-label="项目交付进度">{stageOrder.slice(0, 5).map((item, index) => <div className={`flow-node ${index < current || stage === "delivered" ? "done" : index === current ? "current" : ""}`} key={item}><span>{index < current || stage === "delivered" ? <Check size={13} /> : index + 1}</span><small>{stageLabels[item]}</small></div>)}</div>;
}

function getOverviewViews(state: WorkflowState) {
  const index = getStageIndex(state.stage);
  const requirementMetric = state.requirements.length > 0 ? `${state.requirements.length} 条需求${index === 0 ? "待确认" : "已建立基线"}` : "1 份初始需求待分析";
  const runtimeMetric = index < 3
    ? "等待 UI 审核"
    : index === 3
      ? state.implementationRoute === "hifi-prototype" ? "高保真原型待制作" : "实际 H5 页面待制作"
      : index === 4 ? "5 项用例待验收" : "实现、验收与发布齐备";
  const runtimeAssets = index < 3 ? "上游尚未解锁" : index === 3 ? "FE-01 · FE-03" : "FE-01 · AC-01";
  return [
    { id: "requirements" as const, title: "需求视图", status: index === 0 ? "确认中" : "已确认", metric: requirementMetric, assets: state.requirements.length > 0 ? `${state.requirements[0].id} ~ ${state.requirements[state.requirements.length - 1].id}` : state.project.sourceFileName || "FORM-REQ-01", owner: "运营 · 产品", tone: "blue" },
    { id: "prototype" as const, title: "流程原型", status: index < 1 ? "待创建" : index === 1 ? (state.generated.prototype ? "待确认" : "待生成") : "已确认", metric: index < 1 ? "等待需求确认" : index === 1 ? "3 项原型产出" : "3 项原型已交付", assets: index < 1 ? "上游尚未解锁" : "prototype.md · P-02 · P-03", owner: "产品经理", tone: "peach" },
    { id: "visual" as const, title: "视觉视图", status: index < 2 ? "待创建" : index === 2 ? (state.generated.visual ? "待审核" : "待设计") : "已确认", metric: index < 2 ? "等待原型确认" : index === 2 ? "3 项视觉产出" : "3 项视觉已交付", assets: index < 2 ? "上游尚未解锁" : "D-01 · D-03", owner: "UI 设计师", tone: "lilac" },
    { id: "runtime" as const, title: "运行视图", status: index < 3 ? "待创建" : index === 3 ? (state.generated.frontend ? "待审核" : "待开发") : index === 4 ? "待验收" : "已交付", metric: runtimeMetric, assets: runtimeAssets, owner: "前端 · 验收", tone: "mint" },
  ];
}

function relationStatus(state: WorkflowState, kind: "prototype" | "visual" | "frontend" | "acceptance") {
  const currentIndex = getStageIndex(state.stage);
  const targetIndex = getStageIndex(kind);
  if (currentIndex < targetIndex) return "待创建";
  if (kind === "acceptance") {
    if (state.stage === "delivered") return "已通过";
    return state.acceptanceChecks.length > 0 ? "验收中" : "待验收";
  }
  if (currentIndex > targetIndex) return "已确认";
  return state.generated[kind] ? "待确认" : "待创建";
}

function MappingCell({ id, status }: { id: string; status: string }) {
  if (status === "待创建") return <div className="mapping-cell"><code>待创建</code><span>等待上游生成</span></div>;
  return <div className="mapping-cell"><code>{id}</code><span>{status}</span></div>;
}

function Overview({ state, onNavigate, onAssets, onReset, onStartChange }: { state: WorkflowState; onNavigate: (page: Page) => void; onAssets: (view: AssetView) => void; onReset: () => void; onStartChange: () => void }) {
  const views = getOverviewViews(state);
  const current = getStageIndex(state.stage);
  const viewAction = state.stage === "delivered" ? null : {
    requirement: { view: "requirements" as AssetView, page: "analysis" as Page, label: "开始需求分析" },
    prototype: { view: "prototype" as AssetView, page: "prototype" as Page, label: "继续原型生成" },
    visual: { view: "visual" as AssetView, page: "visual" as Page, label: "继续 UI 设计" },
    frontend: { view: "runtime" as AssetView, page: "frontend" as Page, label: state.implementationRoute === "hifi-prototype" ? "继续制作高保真原型" : "继续制作实际页面" },
    acceptance: { view: "runtime" as AssetView, page: "acceptance" as Page, label: "继续验收交付" },
  }[state.stage];
  const progress = state.stage === "delivered" ? 100 : Math.round(((current + 1) / 6) * 100);
  const tasks = state.stage === "delivered"
    ? [["检查完整交付物", "需求、原型、视觉和运行资产已形成基线", "完成", "blue"], ["准备下一版变更", "可从变更协同发起 v1.1", "可选", "peach"]]
    : [[`推进${stageLabels[state.stage]}`, `当前责任角色：${state.stage === "visual" ? "UI 设计师" : state.stage === "frontend" ? "前端工程师" : state.stage === "acceptance" ? "验收方" : "产品经理"}`, "当前", "pink"], ["检查上游交付", "确认来源、版本和关联对象完整", "今日", "blue"]];
  return <main className="content"><section className="hero-card"><div><div className="project-title-row"><h2>{state.project.name}</h2><button className="switch-project" onClick={onReset} title="重置并创建新项目"><RotateCcw size={15} />重置演示</button></div><span className={`status ${state.stage === "delivered" ? "success" : "info"}`}>{state.stage === "delivered" ? "已交付 · v1.0" : `${stageLabels[state.stage]} · 进行中`}</span></div><div className="overview-hero-actions"><button className="outline-action change-launch-button" onClick={onStartChange}>{state.changeRequest ? <FileCode2 size={16} /> : <Plus size={16} />}{state.changeRequest ? `查看 ${state.changeRequest.id}` : "发起需求变更"}</button>{state.stage === "delivered" && <button className="gradient-button" onClick={() => onNavigate("assets")}>查看完整交付 <ChevronRight size={17} /></button>}</div></section>
    <FlowStrip stage={state.stage} />
    {state.changeRequest && <button className="overview-change-banner" onClick={() => onNavigate("changes")}><span><GitBranch size={17} /></span><div><small>{state.changeRequest.id} · {changeStatusLabels[state.changeRequest.status]}</small><strong>{state.changeRequest.title || "未命名需求变更"}</strong><p>{state.changeRequest.status === "completed" ? "全部责任角色已提交变更内容，可查看完整流转记录。" : "变更协同独立于主交付阶段进行，点击继续处理。"}</p></div><ChevronRight size={18} /></button>}
    <section className="section-head"><div><h2>四视图协同板</h2><p>视图随交付阶段同步更新；待创建项会显示其上游解锁条件。</p></div><span className={`status ${state.stage === "delivered" ? "success" : "info"}`}>{state.stage === "delivered" ? "6 / 6 阶段完成" : `${current + 1} / 6 阶段进行中`}</span></section>
    <section className="view-grid">{views.map((view) => {
      const isCurrentViewAction = viewAction?.view === view.id;
      return <article className={`view-card ${view.tone}`} key={view.id}><div className="card-title"><h3>{view.title}</h3><i /></div><span className="view-state-label">{view.status}</span><strong>{view.metric}</strong><button className="asset-block view-asset-button" onClick={() => onAssets(view.id)}><span>{view.status === "待创建" ? "解锁条件" : "当前资产"}</span><code>{view.assets}</code><small>浏览具体资产 <ChevronRight size={13} /></small></button>{isCurrentViewAction && <button className="gradient-button view-card-action" onClick={() => onNavigate(viewAction.page)}>{viewAction.label} <ChevronRight size={16} /></button>}<div className="card-footer"><AvatarStack /><span>{view.owner}</span></div></article>;
    })}</section>
    <section className="today-grid"><div className="today-main"><div className="section-head compact"><div><h2>当前协作</h2><p>系统只开放当前阶段和已完成阶段，避免越级操作。</p></div></div><div className="task-list workflow-tasks">{tasks.map(([title, desc, date, tone]) => <article className="mini-task" key={title}><i className={tone} /><strong>{title}</strong><p>{desc}</p><span className={`date ${tone}`}>{date}</span></article>)}</div></div><article className="pulse"><small>PROJECT PULSE</small><div><strong>{progress}%</strong><p>{stageLabels[state.stage]}<br />{state.stage === "delivered" ? "当前无阻塞项" : "按顺序推进中"}</p></div><div className="progress"><span style={{ width: `${progress}%` }} /></div></article></section>
  </main>;
}

function AvatarStack() {
  return <div className="avatar-stack" aria-label="关联角色"><span>林</span><span>周</span><span>许</span><span>陈</span></div>;
}

function RequirementCenter({ state, onAnalysis, onAssets }: { state: WorkflowState; onAnalysis: () => void; onAssets: () => void }) {
  const confirmed = getStageIndex(state.stage) > 0;
  const requirementStatus = confirmed ? "已确认" : "待确认";
  return <main className="content"><section className="requirement-source-card"><div><span className={`status ${confirmed ? "success" : "info"}`}>{confirmed ? "v1.0 已确认" : "需求确认中"}</span><h2>{state.project.name}</h2><p>{state.project.requirement}</p></div><div className="source-summary"><span>需求来源</span><strong>{state.project.sourceMode === "upload" ? state.project.sourceFileName : "结构化需求表单"}</strong><small>{state.project.sourceMode === "upload" ? "原始附件已保留" : "业务方直接填写"}</small></div></section>
    <section className="requirement-fields"><article><span>活动背景</span><p>{state.project.background}</p></article><article><span>活动时间轴</span><p>{state.project.timeline}</p></article><article><span>核心目标</span><p>{state.project.coreGoal}</p></article><article><span>数据目标</span><p>{state.project.dataGoal}</p></article></section>
    <section className="section-head mapping-heading"><div><h2>需求对照表</h2><p>分析结果拆分为可追踪的需求项；后续变更以这张表计算跨阶段影响范围。</p></div><div className="mapping-actions"><span className={`status ${confirmed ? "success" : "info"}`}>{state.requirements.length > 0 ? `${state.requirements.length} 条 · ${requirementStatus}` : "尚未生成"}</span><button className="gradient-button small" onClick={confirmed ? onAssets : onAnalysis}>{confirmed ? "查看需求资产" : state.analysisStatus === "ready" ? "继续确认" : "开始分析"}<ChevronRight size={15} /></button></div></section>
    {state.requirements.length === 0 ? <section className="mapping-empty"><WandSparkles size={26} /><h3>需求对照表将在分析后生成</h3><p>AI 会把原始需求拆分为 REQ-* 条目并建立关联占位；人工确认后冻结为 v1.0。</p><button className="gradient-button" onClick={onAnalysis}>进入需求分析 <ChevronRight size={16} /></button></section> : <section className="mapping-table" role="table" aria-label="需求与交付资产对照表">
      <div className="mapping-table-head" role="row"><span>需求项</span><span>优先级 / 状态</span><span>流程依据</span><span>视觉依据</span><span>前端实现</span><span>验收用例</span></div>
      {state.requirements.map((item) => <article className="mapping-row" role="row" key={item.id}>
        <div className="mapping-requirement" role="cell"><code>{item.id}</code><strong>{item.title}</strong><p>{item.summary}</p></div>
        <div className="mapping-state" role="cell" data-label="优先级 / 状态"><span className="priority-tag">{item.priority}</span><span>{requirementStatus}</span><small>{confirmed ? "v1.0" : "分析草稿"}</small></div>
        <div role="cell" data-label="流程依据"><MappingCell id={item.flowBasis} status={relationStatus(state, "prototype")} /></div>
        <div role="cell" data-label="视觉依据"><MappingCell id={item.visualBasis} status={relationStatus(state, "visual")} /></div>
        <div role="cell" data-label="前端实现"><MappingCell id={item.frontend} status={relationStatus(state, "frontend")} /></div>
        <div role="cell" data-label="验收用例"><MappingCell id={item.acceptance} status={relationStatus(state, "acceptance")} /></div>
      </article>)}
    </section>}
    <section className="mapping-rule"><Workflow size={18} /><div><strong>变更影响判定依据</strong><p>未来创建 CR-* 变更单时，系统从受影响的 REQ-* 出发，先定位 prototype.md 中的具体状态 ID，再沿视觉依据、前端实现和验收用例找到需要更新的对象；未命中的资产继续沿用当前版本。</p></div></section>
  </main>;
}

function AnalysisPage({ state, update, onBack, onConfirmed }: { state: WorkflowState; update: (recipe: (current: WorkflowState) => WorkflowState) => void; onBack: () => void; onConfirmed: () => void }) {
  const [savedAt, setSavedAt] = useState("");
  const [reviewNotice, setReviewNotice] = useState(false);
  const startAnalysis = () => {
    setSavedAt("");
    update((current) => ({ ...current, analysisStatus: "running", audit: [...current.audit, audit("发起 AI 需求分析", "开始提取用户故事、功能清单、验收标准与风险。", "产品经理")] }));
    setTimeout(() => update((current) => current.analysisStatus !== "running" ? current : ({
      ...current,
      analysisStatus: "ready",
      requirements: buildRequirementRows(current.project),
      analysis: {
        userStory: `作为目标用户，我希望通过 ${current.project.name} 完成核心活动任务，并获得明确结果反馈。`,
        functions: `1. 活动入口与需求承接\n2. 核心任务与过程反馈\n3. 结果生成、保存与回看\n4. 数据指标与移动端可用性`,
        acceptance: `核心主路径可完整走通；所有必填输入有校验；375px 无横向溢出；关键结果可保存或回看。`,
        risks: `活动时间紧；外部素材或资源可能延迟；移动端兼容和结果保存需要重点验收。`,
        questions: `活动时间轴是否已经冻结？数据目标的统计口径由谁确认？正式发布地址由谁负责？`,
      },
      audit: [...current.audit, audit("AI 分析完成", `生成 ${buildRequirementRows(current.project).length} 条 REQ-* 需求对照关系，等待产品经理编辑并提交审核。`, "AI 助手")],
    })), 700);
  };
  const updateRequirement = (id: string, patch: Partial<RequirementRow>) => update((current) => ({
    ...current,
    requirements: current.requirements.map((item) => item.id === id ? { ...item, ...patch } : item),
  }));
  const addRequirement = () => {
    setSavedAt("");
    update((current) => {
      const usedNumbers = new Set(current.requirements.map((item) => Number(item.id.match(/\d+$/)?.[0] ?? 0)));
      let nextNumber = 1;
      while (usedNumbers.has(nextNumber)) nextNumber += 1;
      const id = `REQ-${String(nextNumber).padStart(3, "0")}`;
      return {
        ...current,
        requirements: [...current.requirements, {
          id,
          title: "新增需求",
          summary: "请补充需求说明。",
          priority: "P1",
          flowBasis: "",
          visualBasis: "",
          frontend: "FE-01 · FE-02 · FE-03",
          acceptance: "AC-01",
        }],
      };
    });
  };
  const removeRequirement = (id: string) => {
    setSavedAt("");
    update((current) => current.requirements.length <= 1 ? current : ({
      ...current,
      requirements: current.requirements.filter((item) => item.id !== id),
    }));
  };
  const saveDraft = () => {
    const saved = nowLabel();
    setSavedAt(saved);
    update((current) => ({ ...current, audit: [...current.audit, audit("保存需求对照草稿", `${current.requirements.length} 条 REQ-* 需求内容与优先级已保存。`, "产品经理")] }));
  };
  const submitReview = () => {
    if (reviewNotice) return;
    update((current) => ({
      ...current,
      stage: "prototype",
      audit: [...current.audit, audit("需求方自动审核通过（演示）", `${current.requirements.length} 条需求及跨阶段关联冻结为 v1.0，原型生成阶段解锁。`, "需求方 · 产品经理")],
    }));
    setReviewNotice(true);
    setTimeout(onConfirmed, 1700);
  };
  const relationFields: { field: "flowBasis" | "visualBasis" | "frontend" | "acceptance"; label: string }[] = [
    { field: "flowBasis", label: "流程依据" },
    { field: "visualBasis", label: "视觉依据" },
    { field: "frontend", label: "前端实现" },
    { field: "acceptance", label: "验收用例" },
  ];
  return <main className="content"><FlowStrip stage="requirement" /><section className="analysis-layout workflow-analysis requirement-analysis-workspace"><article className="source-card"><span className="status info">原始需求</span><h2>{state.project.name}</h2><small>{state.project.sourceFileName || "结构化表单"}</small><p>{state.project.requirement}</p><div className="input-note"><strong>核心目标</strong><span>{state.project.coreGoal}</span></div><div className="input-note"><strong>数据目标</strong><span>{state.project.dataGoal}</span></div></article><article className="analysis-card requirements-editor-card">
      <div className="analysis-card-head"><div className="ai-title"><span><WandSparkles size={17} /></span><div><h2>AI 结构化建议</h2><p>AI 已将原始输入拆分为后续进入需求中心的完整需求对照表。</p></div></div>{state.analysisStatus === "ready" && <div className="draft-save"><button className="outline-action" onClick={addRequirement}><Plus size={14} />新增需求</button><button className="outline-action" onClick={saveDraft}><Save size={14} />保存草稿</button>{savedAt && <small>已保存 {savedAt}</small>}</div>}</div>
      {state.analysisStatus === "idle" && <div className="generation-empty"><WandSparkles size={26} /><h3>准备分析初始需求</h3><p>系统将生成用户故事、功能清单、验收标准、风险和待确认项。</p><button className="gradient-button" onClick={startAnalysis}>开始 AI 分析 <ChevronRight size={16} /></button></div>}
      {state.analysisStatus === "running" && <div className="generation-empty" aria-live="polite"><LoaderCircle className="spin" size={28} /><h3>正在分析需求</h3><p>正在整理原始输入、目标和交付约束。</p></div>}
      {state.analysisStatus === "ready" && <div className="req-editor-table" role="table" aria-label="AI 生成的需求对照表">
        <div className="req-editor-head" role="row"><span>需求编号</span><span>需求内容</span><span>优先级 / 状态</span>{relationFields.map((item) => <span key={item.field}>{item.label}</span>)}<span>操作</span></div>
        {state.requirements.map((item) => <article className="req-editor-row" role="row" key={item.id}>
          <div className="req-id-cell" role="cell" data-label="需求编号"><code>{item.id}</code><small>编号已锁定</small></div>
          <div className="req-copy-cell" role="cell" data-label="需求内容"><input aria-label={`${item.id} 需求名称`} value={item.title} onChange={(event) => updateRequirement(item.id, { title: event.target.value })} /><textarea aria-label={`${item.id} 需求说明`} rows={2} value={item.summary} onChange={(event) => updateRequirement(item.id, { summary: event.target.value })} /></div>
          <div className="req-priority-cell" role="cell" data-label="优先级 / 状态"><select aria-label={`${item.id} 优先级`} value={item.priority} onChange={(event) => updateRequirement(item.id, { priority: event.target.value as RequirementRow["priority"] })}><option value="P0">P0</option><option value="P1">P1</option></select><small>分析草稿</small></div>
          {relationFields.map(({ field, label }) => <div className="req-relation-cell" role="cell" data-label={label} key={field}><span>待创建</span></div>)}
          <div className="req-row-action" role="cell" data-label="操作"><button type="button" onClick={() => removeRequirement(item.id)} disabled={state.requirements.length <= 1} aria-label={`删除 ${item.id}`} title={state.requirements.length <= 1 ? "至少保留一条需求" : `删除 ${item.id}`}><Trash2 size={15} /></button></div>
        </article>)}
      </div>}
    </article></section>
    <section className="review-bar"><div><h2>{state.analysisStatus === "ready" ? "提交关联角色审核后建立 v1.0 需求基线" : "先完成需求分析"}</h2><p>{state.analysisStatus === "ready" ? "演示环境中由需求方自动审核；通过后冻结当前表格并解锁原型阶段。" : "分析完成后可编辑并保存完整需求对照草稿。"}</p></div><div><button className="plain-action" onClick={onBack}>退回需求中心</button>{state.analysisStatus === "ready" ? <><button className="outline-action" onClick={startAnalysis} disabled={reviewNotice}>重新生成</button><button className="gradient-button teal" onClick={submitReview} disabled={reviewNotice}>{reviewNotice ? "审核已通过" : "提交关联角色审核"} <ChevronRight size={17} /></button></> : <button className="gradient-button" onClick={startAnalysis} disabled={state.analysisStatus === "running"}>{state.analysisStatus === "running" ? "分析中" : "开始分析"}</button>}</div></section>
    {reviewNotice && <div className="workflow-review-backdrop"><section className="workflow-review-dialog" role="status" aria-live="polite"><div className="workflow-review-icon"><CheckCircle2 size={24} /></div><strong>需求方已自动审核通过（演示）</strong><span>需求对照表已冻结为 v1.0，正在进入原型阶段。</span></section></div>}
  </main>;
}

function StageWorkspace({ kind, state, update, onComplete }: { kind: DeliveryStage; state: WorkflowState; update: (recipe: (current: WorkflowState) => WorkflowState) => void; onComplete: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [reviewStep, setReviewStep] = useState<0 | 1 | 2>(0);
  const isHifiRoute = state.implementationRoute === "hifi-prototype";
  const config = {
    prototype: { title: "生成流程原型", role: "产品经理", source: "v1.0 需求基线", next: "UI 设计师", button: "提交关联角色审核" },
    visual: { title: "生成并审核 UI 设计", role: "UI 设计师", source: "prototype.md 已确认流程依据", next: "前端工程师", button: "选择审核路线" },
    frontend: isHifiRoute
      ? { title: "制作高保真可交互原型", role: "前端工程师", source: "D-01 关键帧已审核", next: "验收方", button: "通过高保真原型审核并发起验收" }
      : { title: "制作实际 H5 页面", role: "前端工程师", source: "D-01 ~ D-03 全部 UI 已审核", next: "验收方", button: "通过实际页面审核并发起验收" },
  }[kind];
  const currentIndex = getStageIndex(state.stage);
  const targetIndex = getStageIndex(kind);
  const locked = currentIndex < targetIndex;
  const completed = currentIndex > targetIndex;
  const generated = state.generated[kind] || completed;
  const requirementRange = state.requirements.length > 0 ? `${state.requirements[0].id} ~ ${state.requirements[state.requirements.length - 1].id}` : "REQ-*";
  const uploadedFiles = state.uploads?.[kind] ?? [];
  const activeOutputs = outputsFor(kind, state.implementationRoute);
  const prototypePrompt = [
    "你是一名资深产品经理，请基于以下已确认需求生成可交付的流程原型方案。",
    `项目名称：${state.project.name}`,
    `活动背景：${state.project.background}`,
    `活动时间轴：${state.project.timeline}`,
    `核心目标：${state.project.coreGoal}`,
    `数据目标：${state.project.dataGoal}`,
    "已确认需求：",
    ...state.requirements.map((item) => `${item.id}｜${item.priority}｜${item.title}：${item.summary}`),
    "请以 prototype.md 为主要产出，包含：1. 原型范围与核心路径；2. 带唯一状态 ID 的页面与状态表；3. 每个状态的进入条件、可执行动作、即时反馈、数据变化和离开条件；4. 加载、空数据、失败与恢复状态。另附产品功能架构图和 Mermaid 主流程图。所有状态必须标注关联的 REQ-*。",
  ].join("\n");
  const visualPrompt = [
    "你是一名资深 UI 设计师，请基于已确认需求和流程状态生成 3-4 个可评审的设计关键帧。",
    `项目名称：${state.project.name}`,
    `活动背景：${state.project.background}`,
    `核心目标：${state.project.coreGoal}`,
    "需求与流程依据：",
    ...state.requirements.map((item) => `${item.id}｜${item.priority}｜${item.title}：${item.summary}\n流程依据：${item.flowBasis}`),
    "请输出：1. 关键帧选择理由与覆盖的状态 ID；2. 每个关键帧的页面目标、信息层级、组件、状态和交互反馈；3. 375px 移动端适配说明；4. 视觉规范与可复用组件建议。关键帧必须覆盖核心路径、一个关键反馈状态，并标注关联的 REQ-* 与 AVATAR-*。",
  ].join("\n");
  const promptToCopy = kind === "visual" ? visualPrompt : prototypePrompt;
  const copyPrompt = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = promptToCopy;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("copy failed");
      }
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setCopyStatus("failed");
    }
  };
  const uploadFiles = (files: FileList | null) => {
    const names = Array.from(files ?? []).map((file) => file.name);
    if (names.length === 0) return;
    update((current) => {
      const existing = current.uploads?.[kind] ?? [];
      const nextFiles = [...new Set([...existing, ...names])];
      return {
        ...current,
        uploads: { ...(current.uploads ?? {}), [kind]: nextFiles },
        audit: [...current.audit, audit(`上传${stageLabels[kind]}交付物`, names.join("、"), config.role)],
      };
    });
  };
  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      update((current) => ({
        ...current,
        generated: { ...current.generated, [kind]: true },
        requirements: current.requirements.map((item) => kind === "prototype"
          ? { ...item, flowBasis: flowBasisFor(item, current.project) }
          : kind === "visual"
            ? { ...item, visualBasis: visualBasisFor(item, current.project) }
            : item),
        audit: [...current.audit, audit(`${stageLabels[kind]}产出已生成`, `${activeOutputs.length} 项交付物已生成，需求对照关系同步为待审核。`, config.role)],
      }));
      setGenerating(false);
    }, 700);
  };
  const chooseVisualRoute = (route: ImplementationRoute) => {
    const hifi = route === "hifi-prototype";
    update((current) => ({
      ...current,
      stage: "frontend",
      implementationRoute: route,
      audit: [...current.audit, audit(
        hifi ? "关键帧审核通过" : "全部 UI 审核通过",
        hifi
          ? "D-01 关键帧已冻结，下一步制作高保真可交互原型。"
          : "D-01 至 D-03 全部 UI 资产已冻结，下一步直接制作实际 H5 页面。",
        "UI 设计师 · 产品经理",
      )],
    }));
    onComplete();
  };
  const confirm = () => {
    const next: WorkflowStage = kind === "prototype" ? "visual" : kind === "visual" ? "frontend" : "acceptance";
    if (kind === "prototype") {
      if (reviewStep > 0) return;
      setReviewStep(1);
      setTimeout(() => setReviewStep(2), 1100);
      setTimeout(() => {
        update((current) => ({
          ...current,
          stage: next,
          audit: [
            ...current.audit,
            audit("需求方自动审核通过（演示）", "需求方已确认原型覆盖需求基线。", "需求方"),
            audit("开发自动通过需求评审（演示）", "开发已确认 prototype.md 状态范围和需求关联，可进入 UI 设计阶段。", "开发"),
          ],
        }));
        onComplete();
      }, 2300);
      return;
    }
    if (kind === "visual") return;
    update((current) => ({ ...current, stage: next, audit: [...current.audit, audit(`${stageLabels[kind]}已确认`, `交付物已确认，任务交接给${config.next}。`, config.role)] }));
    onComplete();
  };
  if (locked) return <main className="content"><FlowStrip stage={state.stage} /><section className="asset-empty-state"><Folders size={28} /><h3>{stageLabels[kind]}尚未解锁</h3><p>请先完成并确认上游阶段，系统不会允许越级生成或审核。</p><button className="gradient-button" onClick={onComplete}>返回项目总览 <ChevronRight size={16} /></button></section></main>;
  return <main className="content"><FlowStrip stage={state.stage} /><section className="stage-hero"><div><span className={`status ${completed ? "success" : "info"}`}>{completed ? "已确认 · v1.0" : `${config.role}负责`}</span><h2>{config.title}</h2><p>来源：{config.source}</p></div><div className="handoff-chip"><UsersRound size={18} /><span>下一责任角色</span><strong>{config.next}</strong></div></section>
    <section className="stage-workspace"><aside className="stage-source"><span>上游输入</span><h3>{state.project.name}</h3><p>{kind === "prototype" ? state.analysis.userStory : kind === "visual" ? "已确认的需求、prototype.md、功能架构与主流程图。" : isHifiRoute ? "已审核的 D-01 关键帧及其需求、状态 ID 关联。" : "已审核的完整视觉依据、关键帧、组件规范和设计交付链接。"}</p><div><small>基线版本</small><code>v1.0</code></div><div><small>来源资产</small><code>{kind === "prototype" ? requirementRange : kind === "visual" ? "REQ-001 ~ REQ-009 · prototype.md" : isHifiRoute ? "D-01 关键帧" : "visual-spec.md · D-01 ~ D-03"}</code></div>{(kind === "prototype" || kind === "visual") && <button className="outline-action stage-copy-prompt" onClick={copyPrompt}><Copy size={15} />{copyStatus === "copied" ? "已复制 Prompt" : copyStatus === "failed" ? "复制失败，请重试" : kind === "visual" ? "复制需求为关键帧 Prompt" : "复制需求为 Prompt"}</button>}</aside><div className="stage-output"><div className="stage-output-head"><div><h2>本阶段交付物</h2><p>{kind === "prototype" ? "AI 以 prototype.md 汇总页面与状态，其他文件作为结构和流程补充。" : kind === "visual" ? "先生成关键帧与 UI 交付草案，再按审核范围选择下一条制作路线。" : isHifiRoute ? "依据关键帧制作可交互的高保真 H5 原型。" : "依据完整 UI 交付制作可上线演示的实际 H5 页面。"}</p></div><div className="stage-output-actions"><label className="outline-action stage-upload-button"><Upload size={15} />上传交付物<input type="file" multiple accept=".md,.txt,.doc,.docx,.pdf,.png,.jpg,.jpeg,.fig,.zip" onChange={(event) => { uploadFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>{!generated && <button className="gradient-button" onClick={generate} disabled={generating}>{generating ? <><LoaderCircle className="spin" size={16} />生成中</> : <><WandSparkles size={16} />{kind === "visual" ? "生成 UI 交付草案" : "生成交付草案"}</>}</button>}</div></div>
      {uploadedFiles.length > 0 && <div className="stage-uploaded-files" aria-live="polite"><strong>已上传 {uploadedFiles.length} 项</strong>{uploadedFiles.map((name) => <span key={name}><FileText size={13} />{name}</span>)}</div>}
      {!generated ? <div className="stage-empty" aria-live="polite">{generating ? <LoaderCircle className="spin" size={28} /> : <Workflow size={28} />}<h3>{generating ? "正在生成交付物" : "尚未生成本阶段资产"}</h3><p>{generating ? "正在关联上游版本与页面状态。" : "生成前只读取已确认的上游基线。"}</p></div> : <div className="output-grid">{activeOutputs.map((item) => <article className={`output-card ${item.primary ? "primary-output" : ""}`} key={item.id}><div><code>{item.id}</code><span className="status success">{completed ? "已确认" : "待审核"}</span></div><h3>{item.title}</h3><p>{item.description}</p><footer><span>{item.type}</span><button aria-label={`预览${item.title}`}><ExternalLink size={14} />预览</button></footer></article>)}</div>}
    </div></section>
    {kind === "prototype" && generated && <section className="prototype-mapping-update"><header><div><h2>需求对照表更新</h2><p>prototype.md 生成后，系统将每条需求关联到页面与状态表中的具体状态 ID。</p></div><span className="status info">{state.requirements.length} 条已更新</span></header><div className="prototype-mapping-table" role="table" aria-label="原型生成后的需求对照更新"><div className="prototype-mapping-head" role="row"><span>需求项</span><span>更新前</span><span>流程依据</span><span>更新后</span></div>{state.requirements.map((item) => <article className="prototype-mapping-row" role="row" key={item.id}><div role="cell" data-label="需求项"><code>{item.id}</code><strong>{item.title}</strong></div><div role="cell" data-label="更新前"><span className="mapping-before">待创建</span></div><div role="cell" data-label="流程依据"><code>{item.flowBasis}</code></div><div role="cell" data-label="更新后"><span className="mapping-after"><CheckCircle2 size={14} />待审核</span></div></article>)}</div></section>}
    {kind === "visual" && generated && !completed ? <section className="visual-route-section"><header><div><h2>选择 UI 审核范围与下一步</h2><p>两条路线共享同一需求与状态 ID 关联，但交接给前端的设计完成度不同。</p></div><button className="outline-action" onClick={generate}>重新生成</button></header><div className="visual-route-grid"><article><span>路线 A · 关键帧评审</span><h3>制作高保真原型</h3><p>审核并冻结 D-01 核心关键帧；下一步由前端补齐交互与状态，形成可评审的高保真 H5 原型。</p><div><code>D-01 已覆盖关键状态</code><button className="gradient-button teal" onClick={() => chooseVisualRoute("hifi-prototype")}>通过关键帧审核 <ChevronRight size={16} /></button></div></article><article><span>路线 B · 全量 UI 评审</span><h3>直接制作实际页面</h3><p>审核 D-01 至 D-03 的关键帧、组件规范、切图和标注；下一步直接实现实际 H5 页面。</p><div><code>D-01 ~ D-03 全部确认</code><button className="gradient-button" onClick={() => chooseVisualRoute("actual-page")}>通过全部 UI 审核 <ChevronRight size={16} /></button></div></article></div></section> : <section className="review-bar"><div><h2>{completed ? `${stageLabels[kind]}已完成` : generated ? kind === "prototype" ? "提交关联角色审核后交接 UI" : "审核通过后写入交付链路" : "先生成并检查交付物"}</h2><p>{completed ? kind === "visual" ? `已选择“${isHifiRoute ? "制作高保真原型" : "直接制作实际页面"}”路线，可随时回看 UI 资产。` : `已由${config.role}确认，可随时回看。` : kind === "prototype" ? "需求方与开发将依次完成演示审核，通过后进入 UI 设计阶段。" : kind === "visual" ? "生成 UI 交付草案后，可按审核完成度选择下一条制作路线。" : `确认后将任务与来源版本同步给${config.next}。`}</p></div><div>{generated && !completed && kind !== "visual" && <><button className="outline-action" onClick={generate} disabled={reviewStep > 0}>重新生成</button><button className="gradient-button teal" onClick={confirm} disabled={reviewStep > 0}>{reviewStep > 0 ? "审核中" : config.button} <ChevronRight size={17} /></button></>}{completed && <button className="plain-action" disabled><Check size={15} /> 已完成交接</button>}</div></section>}
    {reviewStep > 0 && <div className="workflow-review-backdrop"><section className="workflow-review-dialog" role="status" aria-live="polite"><div className="workflow-review-icon"><CheckCircle2 size={24} /></div><small className="workflow-review-step">审核 {reviewStep} / 2</small><strong>{reviewStep === 1 ? "需求方已自动审核通过（演示）" : "开发已自动通过需求评审（演示）"}</strong><span>{reviewStep === 1 ? "prototype.md 已覆盖当前需求基线，正在提交开发评审。" : "需求范围与状态 ID 关联已确认，正在进入 UI 设计阶段。"}</span></section></div>}
  </main>;
}

function AcceptancePage({ state, update, onDelivered }: { state: WorkflowState; update: (recipe: (current: WorkflowState) => WorkflowState) => void; onDelivered: () => void }) {
  const complete = state.acceptanceChecks.length === acceptanceItems.length;
  const delivered = state.stage === "delivered";
  const requirementRange = state.requirements.length > 0 ? `${state.requirements[0].id} ~ ${state.requirements[state.requirements.length - 1].id}` : "REQ-*";
  const toggle = (id: string) => update((current) => ({ ...current, acceptanceChecks: current.acceptanceChecks.includes(id) ? current.acceptanceChecks.filter((item) => item !== id) : [...current.acceptanceChecks, id] }));
  const deliver = () => {
    update((current) => ({ ...current, stage: "delivered", audit: [...current.audit, audit("验收通过并交付 v1.0", "所有必验项通过，发布包和正式体验地址已建立。", "验收方 · 发布负责人")] }));
    onDelivered();
  };
  return <main className="content"><FlowStrip stage={state.stage} /><section className="stage-hero"><div><span className={`status ${delivered ? "success" : "info"}`}>{delivered ? "v1.0 已交付" : "验收方负责"}</span><h2>{delivered ? "验收完成，项目已交付" : "执行交付验收"}</h2><p>来源：FE-01 · FE-03 已审核前端实现</p></div><div className="acceptance-score"><strong>{state.acceptanceChecks.length}/{acceptanceItems.length}</strong><span>必验项通过</span></div></section>
    <section className="acceptance-layout"><div className="acceptance-list"><div className="stage-output-head"><div><h2>验收清单</h2><p>任一必验项未通过时，不允许生成交付版本。</p></div>{!delivered && <button className="outline-action" onClick={() => update((current) => ({ ...current, acceptanceChecks: acceptanceItems.map((item) => item.id) }))}>全部标记通过</button>}</div>{acceptanceItems.map((item) => { const checked = state.acceptanceChecks.includes(item.id); return <label className={`acceptance-item ${checked ? "checked" : ""}`} key={item.id}><input type="checkbox" checked={checked} onChange={() => toggle(item.id)} disabled={delivered} /><span>{checked ? <CheckCircle2 size={21} /> : <Circle size={21} />}</span><div><strong>{item.label}</strong><p>{item.detail}</p></div><code>{checked ? "AC-PASS" : "待执行"}</code></label>; })}</div><aside className="release-panel"><small>拟交付版本</small><h3>v1.0</h3><p>{state.project.name}</p><dl><div><dt>需求基线</dt><dd>{requirementRange}</dd></div><div><dt>原型资产</dt><dd>prototype.md · P-02 · P-03</dd></div><div><dt>视觉资产</dt><dd>visual-spec.md · D-01 · D-03</dd></div><div><dt>实现模块</dt><dd>FE-01 · FE-03</dd></div></dl><span className={`status ${complete ? "success" : "info"}`}>{complete ? "可以交付" : "等待验收完成"}</span></aside></section>
    <section className="review-bar"><div><h2>{delivered ? "v1.0 已成为当前交付版本" : complete ? "所有必验项已经通过" : `还有 ${acceptanceItems.length - state.acceptanceChecks.length} 项待验收`}</h2><p>{delivered ? "需求、资产、验收与发布证据已写入审计记录。" : "确认交付后保留完整版本快照。"}</p></div><div><button className="gradient-button teal" disabled={!complete || delivered} onClick={deliver}>{delivered ? <><Check size={16} />已交付</> : <>确认验收并交付 <ChevronRight size={17} /></>}</button></div></section>
  </main>;
}

function getVisibleAssets(state: WorkflowState, view: AssetView): AssetRecord[] {
  const index = getStageIndex(state.stage);
  if (view === "requirements") {
    if (index === 0) return [{ id: "REQ-SOURCE-01", title: `${state.project.name} · 初始需求`, format: state.project.sourceMode === "upload" ? "原始需求附件" : "结构化表单", source: state.project.sourceMode === "upload" ? "本地附件" : "用户填写", version: "草稿", owner: "运营 · 产品", relations: "项目创建 -> AI 分析", description: state.project.requirement, action: "查看需求" }];
    return fullAssetRecords.requirements.map((item, itemIndex) => itemIndex === 0 ? { ...item, title: `PRD · ${state.project.name}` } : item);
  }
  if (view === "prototype") return index > 1 || state.generated.prototype ? fullAssetRecords.prototype : [];
  if (view === "visual") return index > 2 || state.generated.visual ? fullAssetRecords.visual : [];
  if (view === "runtime") {
    if (state.stage === "delivered") return fullAssetRecords.runtime;
    if (index > 3 || state.generated.frontend) return fullAssetRecords.runtime.slice(0, 2);
  }
  return [];
}

function AssetIcon({ format }: { format: string }) {
  const Icon = format.includes("链接") || format.includes("HTTPS") || format.includes("Figma") || format.includes("蓝湖") ? Link : format.includes("PNG") || format.includes("HTML") ? Image : format.includes("ZIP") ? Package : FileText;
  return <Icon size={18} />;
}

function AssetsPage({ state, initialView, onNavigate }: { state: WorkflowState; initialView: AssetView; onNavigate: (page: Page) => void }) {
  const [active, setActive] = useState<AssetView>(initialView);
  const [preview, setPreview] = useState<AssetRecord | null>(null);
  useEffect(() => setActive(initialView), [initialView]);
  const tabs = (["requirements", "prototype", "visual", "runtime"] as AssetView[]).map((id) => ({ id, label: id === "requirements" ? "需求视图" : id === "prototype" ? "流程原型" : id === "visual" ? "视觉视图" : "运行视图", count: `${getVisibleAssets(state, id).length} 份` }));
  const records = getVisibleAssets(state, active);
  const targetPage: Record<AssetView, Page> = { requirements: "analysis", prototype: "prototype", visual: "visual", runtime: getStageIndex(state.stage) >= 4 ? "acceptance" : "frontend" };
  return <main className="content assets-page"><section className="asset-intro"><div><span className={`status ${state.stage === "delivered" ? "success" : "info"}`}>{state.stage === "delivered" ? "v1.0 已交付" : `${stageLabels[state.stage]}进行中`}</span><h2>{state.project.name}交付物总库</h2><p>按交接顺序管理文档、图表、设计附件、协作链接与发布证据。</p></div><span className="asset-source">TraceFlow / {state.project.name}</span></section><section className="asset-bridge"><div className="bridge-intro"><strong>四视图如何协同</strong><p>AI 将需求、流程、设计和实现建议结构化；传统角色确认、审核、交接并对交付负责。</p></div><div className="bridge-step"><WandSparkles size={17} /><span>AI 生成可编辑建议</span></div><ChevronRight size={17} /><div className="bridge-step"><UsersRound size={17} /><span>角色确认与交接</span></div><ChevronRight size={17} /><div className="bridge-step"><Workflow size={17} /><span>版本资产可追溯</span></div></section><section className="asset-tabs" aria-label="资产视图">{tabs.map((tab) => <button key={tab.id} className={active === tab.id ? "selected" : ""} onClick={() => setActive(tab.id)}><span>{tab.label}</span><small>{tab.count}</small></button>)}</section><section className="asset-list-head"><div><h2>{tabs.find((tab) => tab.id === active)?.label}</h2><p>每项均保留格式、版本、负责人、关联对象和交付入口。</p></div><span className="status info">{records.length} 项交付物</span></section>{records.length === 0 ? <section className="asset-empty-state"><Folders size={27} /><h3>该视图尚未创建交付物</h3><p>完成上游确认后，本阶段才会解锁并生成资产。</p><button className="gradient-button" onClick={() => onNavigate(targetPage[active])}>前往当前流程 <ChevronRight size={16} /></button></section> : <section className="asset-records">{records.map((record) => <article className="asset-record rich" key={record.id}><div className="asset-file"><AssetIcon format={record.format} /><code>{record.id}</code></div><div className="asset-copy"><div className="asset-title"><h3>{record.title}</h3><span className={`asset-source-tag ${record.simulated ? "simulated" : "local"}`}>{record.source}</span></div><p>{record.description}</p></div><div className="asset-meta"><span>{record.format}</span><strong>{record.version}</strong></div><div className="asset-meta"><span>关联对象</span><code>{record.relations}</code></div><div className="asset-owner"><span>责任角色</span><strong>{record.owner}</strong></div><button className="asset-action" onClick={() => setPreview(record)}>{record.action} <ExternalLink size={14} /></button></article>)}</section>}
    {preview && <div className="modal-backdrop" role="presentation" onMouseDown={() => setPreview(null)}><section className="asset-preview-modal" role="dialog" aria-modal="true" aria-labelledby="asset-preview-title" onMouseDown={(event) => event.stopPropagation()}><header><div><code>{preview.id}</code><h2 id="asset-preview-title">{preview.title}</h2></div><button className="icon-button" onClick={() => setPreview(null)} aria-label="关闭预览"><X size={18} /></button></header><div className="preview-placeholder"><AssetIcon format={preview.format} /><strong>{preview.format}</strong><p>{preview.simulated ? "这是用于完整演示交付链路的模拟资料，不代表真实外部系统已经接入。" : "该本地资料已纳入项目交付链路；当前预览展示其元数据与关联关系。"}</p></div><dl><div><dt>版本</dt><dd>{preview.version}</dd></div><div><dt>责任角色</dt><dd>{preview.owner}</dd></div><div><dt>关联对象</dt><dd>{preview.relations}</dd></div><div><dt>来源</dt><dd>{preview.source}</dd></div></dl><footer><button className="plain-action" onClick={() => setPreview(null)}>关闭</button><button className="gradient-button" onClick={() => setPreview(null)}>完成查看</button></footer></section></div>}
  </main>;
}

function AuditPage({ state, onReset }: { state: WorkflowState; onReset: () => void }) {
  return <main className="content"><section className="audit-hero"><div><span className="status info">本地审计</span><h2>版本与流转记录</h2><p>刷新页面后仍保留；重置演示会清空当前项目并返回初始页。</p></div><button className="danger-action" onClick={onReset}><RotateCcw size={16} />重置演示</button></section><section className="audit-timeline">{[...state.audit].reverse().map((entry, index) => <article key={entry.id}><span className={index === 0 ? "latest" : ""}><Check size={14} /></span><div><small>{entry.time} · {entry.role}</small><h3>{entry.action}</h3><p>{entry.detail}</p></div></article>)}</section></main>;
}

function ResetConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}><section className="reset-confirm" role="dialog" aria-modal="true" aria-labelledby="reset-confirm-title" onMouseDown={(event) => event.stopPropagation()}><div className="reset-icon"><RotateCcw size={22} /></div><h2 id="reset-confirm-title">重置当前演示？</h2><p>项目、版本和审计记录会从当前浏览器清除，并返回“无项目”初始页。</p><footer><button className="plain-action" onClick={onCancel}>取消</button><button className="danger-action" onClick={onConfirm}>确认重置</button></footer></section></div>;
}

const changeTaskStatusLabels: Record<ChangeTaskStatus, string> = {
  waiting: "待提交申请",
  "pending-approval": "待同意",
  approved: "已同意 · 待提交",
  submitted: "已提交",
};

function changeFlowIndex(status: ChangeRequestStatus) {
  return { draft: 0, analyzing: 1, "analysis-ready": 2, "pending-approval": 3, "in-progress": 4, completed: 5 }[status];
}

function ChangeFlow({ status }: { status: ChangeRequestStatus }) {
  const current = changeFlowIndex(status);
  const steps = ["描述变更", "AI 影响分析", "提交申请", "角色同意", "内容提交"];
  return <div className="change-flow" aria-label="变更申请进度">{steps.map((step, index) => {
    const done = current > index || status === "completed";
    const active = current === index && status !== "completed";
    return <div className={`change-flow-node ${done ? "done" : ""} ${active ? "current" : ""}`} key={step}><span>{done ? <Check size={13} /> : index + 1}</span><small>{step}</small></div>;
  })}</div>;
}

function ChangesPage({ state, update, onStart }: { state: WorkflowState; update: (recipe: (current: WorkflowState) => WorkflowState) => void; onStart: () => void }) {
  const change = state.changeRequest;
  const [formError, setFormError] = useState("");
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});

  if (!change) return <main className="content"><section className="change-empty"><div><GitBranch size={27} /></div><span className="status info">随时可发起</span><h2>当前没有需求变更</h2><p>需求变更独立于主交付阶段。任何固定演示角色都可以创建申请，再由 AI 沿需求对照表定位需要同步的视图、资产和责任人。</p><button className="gradient-button" onClick={onStart}><Plus size={16} />发起需求变更</button></section></main>;

  const patchChange = (patch: Partial<ChangeRequest>) => update((current) => current.changeRequest ? ({ ...current, changeRequest: { ...current.changeRequest, ...patch } }) : current);
  const editField = (field: "title" | "description" | "initiator", value: string) => {
    setFormError("");
    update((current) => {
      if (!current.changeRequest) return current;
      const invalidateAnalysis = current.changeRequest.status === "analysis-ready";
      return { ...current, changeRequest: { ...current.changeRequest, [field]: value, status: invalidateAnalysis ? "draft" : current.changeRequest.status, tasks: invalidateAnalysis ? [] : current.changeRequest.tasks, changeType: invalidateAnalysis ? undefined : current.changeRequest.changeType, impactLevel: invalidateAnalysis ? undefined : current.changeRequest.impactLevel, analysisSummary: invalidateAnalysis ? undefined : current.changeRequest.analysisSummary } };
    });
  };
  const loadExample = () => {
    patchChange({
      title: "新增主题模板自定义色彩变体",
      description: "在现有主题模板基础上新增自定义色彩变体。用户选择模板后可调整主色，并在头像预览中实时查看；需要保留默认主题色和恢复默认能力。",
      initiator: "业务方",
      status: "draft",
      tasks: [],
      changeType: undefined,
      impactLevel: undefined,
      analysisSummary: undefined,
    });
    setFormError("");
  };
  const analyze = () => {
    if (!change.title.trim() || !change.description.trim()) {
      setFormError("请先填写变更标题和完整的需求变更描述。");
      return;
    }
    patchChange({ status: "analyzing" });
    window.setTimeout(() => update((current) => {
      if (!current.changeRequest || current.changeRequest.status !== "analyzing") return current;
      const tasks = buildChangeTasks(current, current.changeRequest.description);
      const requirementIds = [...new Set(tasks.flatMap((task) => task.requirementIds))];
      const nextChange: ChangeRequest = {
        ...current.changeRequest,
        status: "analysis-ready",
        changeType: getChangeType(current.changeRequest.description),
        impactLevel: "跨视图协同",
        analysisSummary: `AI 从需求对照表命中 ${requirementIds.join("、")}，沿流程依据、视觉依据、前端实现与验收用例生成 ${tasks.length} 项角色任务。`,
        tasks,
      };
      return { ...current, changeRequest: nextChange, audit: [...current.audit, audit(`AI 完成 ${nextChange.id} 影响分析`, `${nextChange.analysisSummary}`, "AI 协同助手")] };
    }), 900);
  };
  const submitApplication = () => update((current) => {
    if (!current.changeRequest || current.changeRequest.status !== "analysis-ready") return current;
    const nextChange = { ...current.changeRequest, status: "pending-approval" as const, submittedAt: nowLabel(), tasks: current.changeRequest.tasks.map((task) => ({ ...task, status: "pending-approval" as const })) };
    return { ...current, changeRequest: nextChange, audit: [...current.audit, audit(`提交 ${nextChange.id} 变更申请`, `${nextChange.initiator}提交申请，已通知 ${nextChange.tasks.length} 项关联角色任务。`, nextChange.initiator)] };
  });
  const approveTask = (taskId: string) => update((current) => {
    if (!current.changeRequest) return current;
    const task = current.changeRequest.tasks.find((item) => item.id === taskId);
    if (!task || task.status !== "pending-approval") return current;
    const tasks = current.changeRequest.tasks.map((item) => item.id === taskId ? { ...item, status: "approved" as const } : item);
    return { ...current, changeRequest: { ...current.changeRequest, status: "in-progress", tasks }, audit: [...current.audit, audit(`${task.owner}同意 ${current.changeRequest.id} 变更`, `${task.viewLabel}任务已接收，下一步提交负责的变更内容。`, task.owner)] };
  });
  const updateTask = (taskId: string, patch: Partial<ChangeTask>) => update((current) => current.changeRequest ? ({ ...current, changeRequest: { ...current.changeRequest, tasks: current.changeRequest.tasks.map((task) => task.id === taskId ? { ...task, ...patch } : task) } }) : current);
  const submitTask = (taskId: string) => {
    const task = change.tasks.find((item) => item.id === taskId);
    if (!task || !task.submission.trim()) {
      setTaskErrors((current) => ({ ...current, [taskId]: "请填写本角色完成的变更内容后再提交。" }));
      return;
    }
    setTaskErrors((current) => ({ ...current, [taskId]: "" }));
    update((current) => {
      if (!current.changeRequest) return current;
      const currentTask = current.changeRequest.tasks.find((item) => item.id === taskId);
      if (!currentTask || currentTask.status !== "approved") return current;
      const tasks = current.changeRequest.tasks.map((item) => item.id === taskId ? { ...item, status: "submitted" as const } : item);
      const completed = tasks.every((item) => item.status === "submitted");
      const nextChange = { ...current.changeRequest, status: completed ? "completed" as const : "in-progress" as const, completedAt: completed ? nowLabel() : current.changeRequest.completedAt, tasks };
      const entries = [audit(`${currentTask.owner}提交 ${current.changeRequest.id} 变更内容`, `${currentTask.viewLabel}已交付：${currentTask.submission}`, currentTask.owner)];
      if (completed) entries.push(audit(`${current.changeRequest.id} 协同更新完成`, `5 项关联任务均已同意并提交，${current.changeRequest.targetVersion}内容已齐备。`, "系统"));
      return { ...current, changeRequest: nextChange, audit: [...current.audit, ...entries] };
    });
  };

  const applicationSubmitted = ["pending-approval", "in-progress", "completed"].includes(change.status);
  const submittedCount = change.tasks.filter((task) => task.status === "submitted").length;
  const acceptedCount = change.tasks.filter((task) => task.status === "approved" || task.status === "submitted").length;
  const relatedAudit = [...state.audit].reverse().filter((entry) => entry.action.includes(change.id) || entry.detail.includes(change.id));
  const flowIds = [...new Set(change.tasks.flatMap((task) => task.requirementIds))];

  return <main className="content change-page">
    <section className="change-request-hero"><div><span className={`status ${change.status === "completed" ? "success" : "info"}`}>{changeStatusLabels[change.status]}</span><code>{change.id}</code><h2>{change.title || "未命名需求变更"}</h2><p>{change.initiator}于项目“{stageLabels[change.stageAtCreation]}”阶段发起 · {change.createdAt}</p></div><div className="change-version-compact"><small>版本影响</small><strong>{change.baseVersion}</strong><ChevronRight size={17} /><strong>{change.targetVersion}</strong></div></section>
    <ChangeFlow status={change.status} />

    {!applicationSubmitted && <section className="change-compose"><header><div><span><PenLine size={17} /></span><div><h2>描述变更的需求点</h2><p>申请提交前可持续编辑；修改已完成的 AI 输入会自动作废旧分析。</p></div></div><button className="text-action" onClick={loadExample}>载入色彩变体示例</button></header><div className="change-form-grid"><label><span>发起角色 *</span><select value={change.initiator} onChange={(event) => editField("initiator", event.target.value)} disabled={change.status === "analyzing"}>{(["业务方", "产品经理", "UI 设计师", "前端工程师", "验收方"] as ChangeRole[]).map((role) => <option key={role}>{role}</option>)}</select><small>固定演示角色中的任何人均可发起。</small></label><label><span>变更标题 *</span><input value={change.title} onChange={(event) => editField("title", event.target.value)} placeholder="一句话说明要改什么" disabled={change.status === "analyzing"} /></label><label className="change-description"><span>需求变更描述 *</span><textarea value={change.description} onChange={(event) => editField("description", event.target.value)} placeholder="说明新增、调整或删除的需求点，以及期望的用户结果。" disabled={change.status === "analyzing"} /></label></div>{formError && <p className="field-error change-error" role="alert">{formError}</p>}<footer><p>AI 只提供影响建议；提交申请后才会通知关联角色。</p><button className="gradient-button" onClick={analyze} disabled={change.status === "analyzing"}>{change.status === "analyzing" ? <><LoaderCircle className="spin" size={16} />正在追踪需求关联</> : <><Bot size={16} />AI 分析变更影响</>}</button></footer></section>}

    {change.tasks.length > 0 && <><section className="change-ai-summary" aria-live="polite"><div className="change-ai-icon"><Bot size={21} /></div><div><span>AI 影响分析</span><h2>{change.changeType} · {change.impactLevel}</h2><p>{change.analysisSummary}</p></div><dl><div><dt>命中需求</dt><dd>{flowIds.join("、")}</dd></div><div><dt>影响视图</dt><dd>4 个</dd></div><div><dt>角色任务</dt><dd>{change.tasks.length} 项</dd></div></dl></section><section className="change-relation-trace"><GitBranch size={17} /><div><strong>需求对照表追踪路径</strong><p><code>{flowIds.join("、")}</code><span>→</span><code>prototype.md 状态 ID</code><span>→</span><code>visual-spec.md / 关键帧</code><span>→</span><code>FE 实现</code><span>→</span><code>AC 验收</code></p></div></section></>}

    {change.status === "analysis-ready" && <section className="change-submit-bar"><div><h2>确认影响范围并提交变更申请</h2><p>提交后，五项任务先进入“待同意”；责任人同意后才开放其变更内容编辑器。</p></div><div><button className="outline-action" onClick={() => patchChange({ status: "draft", tasks: [], changeType: undefined, impactLevel: undefined, analysisSummary: undefined })}>返回编辑</button><button className="gradient-button teal" onClick={submitApplication}><Send size={16} />提交变更申请</button></div></section>}

    {applicationSubmitted && <section className="change-application"><ClipboardCheck size={18} /><div><span>已提交的变更申请</span><h2>{change.title}</h2><p>{change.description}</p></div><dl><div><dt>发起人</dt><dd>{change.initiator}</dd></div><div><dt>提交时间</dt><dd>{change.submittedAt}</dd></div></dl></section>}

    {change.tasks.length > 0 && <section className="change-task-section"><header><div><h2>关联角色协同任务</h2><p>每位责任人必须先同意申请，再提交自己负责的变更内容。</p></div><div className="change-task-count"><span><ShieldCheck size={14} />已同意 {acceptedCount}/{change.tasks.length}</span><span><CheckCircle2 size={14} />已提交 {submittedCount}/{change.tasks.length}</span></div></header><div className="change-task-grid">{change.tasks.map((task) => {
      const Icon = task.view === "requirements" ? ClipboardList : task.view === "prototype" ? Workflow : task.view === "visual" ? Image : FileCode2;
      return <article className={`change-task-card ${task.view}`} key={task.id}><header><div className="change-task-view"><span><Icon size={16} /></span><div><small>{task.viewLabel}</small><h3>{task.owner}</h3></div></div><span className={`change-task-status ${task.status}`}>{changeTaskStatusLabels[task.status]}</span></header><div className="change-task-source"><span>关联资产</span><code>{task.asset}</code></div><p>{task.reason}</p><div className="change-task-deliverable"><strong>应提交</strong><span>{task.deliverable}</span></div>{task.status === "pending-approval" && <button className="gradient-button teal change-task-primary" aria-label={`${task.viewLabel}·${task.owner}同意变更`} onClick={() => approveTask(task.id)}><ShieldCheck size={16} />同意变更</button>}{task.status === "approved" && <div className="change-task-editor"><label><span>本角色变更内容 *</span><textarea value={task.submission} onChange={(event) => { updateTask(task.id, { submission: event.target.value }); setTaskErrors((current) => ({ ...current, [task.id]: "" })); }} placeholder="说明已更新的文档、设计、代码或验收结果。" /></label><div className="change-editor-actions"><button className="text-action" onClick={() => updateTask(task.id, { submission: changeExampleSubmissions[task.id] })}>载入演示交付</button><label className="outline-action change-file-button"><Upload size={14} />{task.fileName || "上传附件"}<input type="file" accept=".md,.txt,.doc,.docx,.pdf,.png,.jpg,.jpeg,.fig,.zip" onChange={(event) => updateTask(task.id, { fileName: event.currentTarget.files?.[0]?.name })} /></label></div>{taskErrors[task.id] && <p className="field-error" role="alert">{taskErrors[task.id]}</p>}<button className="gradient-button change-task-primary" aria-label={`${task.viewLabel}·${task.owner}提交变更内容`} onClick={() => submitTask(task.id)}><Send size={15} />提交变更内容</button></div>}{task.status === "submitted" && <div className="change-task-submitted"><CheckCircle2 size={17} /><div><strong>变更内容已提交</strong><p>{task.submission}</p>{task.fileName && <span><FileText size={13} />{task.fileName}</span>}</div></div>}</article>;
    })}</div></section>}

    {change.status === "completed" && <section className="change-complete-banner" role="status"><div><CheckCircle2 size={22} /></div><section><span>{change.targetVersion}</span><h2>关联角色变更内容已全部齐备</h2><p>需求、流程原型、视觉、前端实现与验收记录均保留了提交内容和责任角色，原主交付阶段未被覆盖。</p></section></section>}

    {relatedAudit.length > 0 && <section className="change-history"><header><Clock3 size={17} /><div><h2>申请流转记录</h2><p>从 AI 分析到角色提交的所有动作均写入本地审计。</p></div></header><div>{relatedAudit.map((entry, index) => <article key={entry.id}><span className={index === 0 ? "latest" : ""}><Check size={12} /></span><div><small>{entry.time} · {entry.role}</small><strong>{entry.action}</strong><p>{entry.detail}</p></div></article>)}</div></section>}
  </main>;
}

export default function App() {
  const [state, setState] = useState<WorkflowState | null>(loadState);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState<Page>("overview");
  const [assetView, setAssetView] = useState<AssetView>("requirements");
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  }, [state]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [page, state?.stage]);

  const update = (recipe: (current: WorkflowState) => WorkflowState) => setState((current) => current ? recipe(current) : current);
  const navigate = (next: Page) => { setPage(next); setMenuOpen(false); window.scrollTo({ top: 0, behavior: "auto" }); };
  const openAssets = (view: AssetView) => { setAssetView(view); navigate("assets"); };
  const startChange = () => {
    update((current) => current.changeRequest ? current : ({ ...current, changeRequest: createChangeDraft(current), audit: [...current.audit, audit("创建 CR-001 变更草稿", `可在${stageLabels[current.stage]}阶段描述并分析需求变更。`, "当前演示角色")] }));
    navigate("changes");
  };
  const createProject = (project: ProjectInput) => {
    setState({
      project,
      stage: "requirement",
      analysisStatus: "idle",
      analysis: { userStory: "", functions: "", acceptance: "", risks: "", questions: "" },
      requirements: [],
      generated: { prototype: false, visual: false, frontend: false },
      acceptanceChecks: [],
      audit: [audit("创建项目", `${project.name} 已创建，需求进入确认中。`, "业务方")],
    });
    setCreating(false);
    setPage("overview");
  };
  const openCompletedProject = () => {
    setState(createCompletedAvatarState());
    setCreating(false);
    setPage("overview");
  };
  const reset = () => setResetConfirmOpen(true);
  const confirmReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(null);
    setCreating(false);
    setPage("overview");
    setResetConfirmOpen(false);
  };

  const body = useMemo(() => {
    if (!state) return null;
    if (page === "overview") return <Overview state={state} onNavigate={navigate} onAssets={openAssets} onReset={reset} onStartChange={startChange} />;
    if (page === "requirements") return <RequirementCenter state={state} onAnalysis={() => navigate("analysis")} onAssets={() => openAssets("requirements")} />;
    if (page === "analysis") return <AnalysisPage state={state} update={update} onBack={() => navigate("requirements")} onConfirmed={() => navigate("overview")} />;
    if (page === "prototype" || page === "visual" || page === "frontend") return <StageWorkspace kind={page} state={state} update={update} onComplete={() => navigate("overview")} />;
    if (page === "acceptance") return <AcceptancePage state={state} update={update} onDelivered={() => navigate("overview")} />;
    if (page === "assets") return <AssetsPage state={state} initialView={assetView} onNavigate={navigate} />;
    if (page === "audit") return <AuditPage state={state} onReset={reset} />;
    return <ChangesPage state={state} update={update} onStart={startChange} />;
  }, [assetView, page, state]);

  if (!state) return creating ? <CreateProject onBack={() => setCreating(false)} onCreate={createProject} /> : <EmptyProject onCreate={() => setCreating(true)} onOpenProject={openCompletedProject} />;
  return <div className="app-shell"><div className="glow glow-blue" /><div className="glow glow-pink" /><Sidebar page={page} state={state} open={menuOpen} onNavigate={navigate} onClose={() => setMenuOpen(false)} /><Topbar page={page} state={state} onMenu={() => setMenuOpen(true)} />{body}{resetConfirmOpen && <ResetConfirm onCancel={() => setResetConfirmOpen(false)} onConfirm={confirmReset} />}</div>;
}
