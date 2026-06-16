# ChatArchive WebBridge 批量导出

[English](README.md)

一个面向 Codex、Claude Code、Cursor 等主流编程 agent 的 Agent Skill，用于批量导出并质检 ChatArchive 对话归档。它通过 Kimi WebBridge 使用用户已经登录的真实浏览器会话，按平台注册表选择导出目标，并生成 Markdown、JSON 与 QA 报告。

## 适用场景

- 批量导出多个 AI 聊天平台的历史对话。
- 中断后基于同一输出目录恢复导出。
- 对导出的 Markdown/JSON 文件做一致性检查。
- 抽样打开原始网页，核对首尾消息片段是否与导出内容一致。
- 按账号、平台、会话 ID 组织归档，避免多账号导出时文件冲突。

## Agent 兼容性

本仓库按 Codex、Claude Code、Cursor 以及其他支持 agent instructions 的编程 agent 组织：

- `SKILL.md` 是主要 Agent Skills 入口，frontmatter 包含 `name` 与 `description`，目录名为 `chatarchive-export`。
- `AGENTS.md` 为 Codex、Cursor 以及其他会读取仓库级说明的 agent 提供通用入口。
- `agents/openai.yaml` 保留 OpenAI/Codex 侧展示信息。
- 详细工作流与平台说明放在 `references/` 中，便于 agent 按需加载。

实际执行仍取决于宿主 agent 是否能读取本地文件、运行本地命令，并访问用户环境中的 Kimi WebBridge。

## 项目结构

```text
.
├── SKILL.md                         # Agent Skills 入口说明
├── AGENTS.md                        # 仓库级 agent 指令
├── agents/openai.yaml               # OpenAI/Codex 展示信息
├── platforms/*.json                 # 平台插件 metadata 与 QA notes
├── references/workflow.md           # 通用导出流程与排障说明
├── references/platforms/*.md        # 平台特定 URL、枚举、DOM 与排障说明
└── scripts/
    ├── platform-registry.mjs        # 平台注册表读取与校验工具
    ├── audit-export.mjs             # 本地导出文件审计工具
    └── webpage-sample-check.mjs     # 通过 Kimi WebBridge 抽样核对原网页
```

## 前置条件

1. 在 ChatArchive 仓库根目录运行导出命令，通常为：

   ```bash
   /Users/boyaxie/IdeaProjects/ChatArchive
   ```

2. 确认 ChatArchive 导出脚本存在：

   ```bash
   test -f scripts/bulk-export-webbridge.js
   ```

3. 确认 Kimi WebBridge 正在运行且浏览器扩展已连接：

   ```bash
   ~/.kimi-webbridge/bin/kimi-webbridge status
   ```

   只有在 `running: true` 且 `extension_connected: true` 时才继续。

4. 用户需要已在 WebBridge 控制的浏览器配置中登录目标平台。本项目不会导出 Cookie、绕过登录，也不会绕过 CAPTCHA 或其他登录保护。

5. 如果修改过 ChatArchive 代码，导出前建议运行：

   ```bash
   npm test
   ```

## 快速开始

### 全量导出

在 ChatArchive 仓库根目录执行：

```bash
node scripts/bulk-export-webbridge.js \
  --platform <default-platform-ids> \
  --format md,json \
  --output exports/bulk-$(date +%F) \
  --resume \
  --account-label edge-default
```

`<default-platform-ids>` 指本 skill 的 `platforms/*.json` 中 `defaultEnabled` 为 `true` 的平台 ID，使用逗号拼接后传给 ChatArchive 外部导出器。

### 新账号或浏览器状态不确定时先 dry run

```bash
node scripts/bulk-export-webbridge.js \
  --platform <platform-id>[,<platform-id>] \
  --format md,json \
  --output exports/bulk-$(date +%F) \
  --dry-run \
  --limit 2 \
  --account-label edge-default
```

### 恢复中断导出

使用同一个输出目录和账号标签继续运行，例如：

```bash
node scripts/bulk-export-webbridge.js \
  --platform <platform-id> \
  --format md,json \
  --output exports/bulk-YYYY-MM-DD \
  --resume \
  --account-label edge-default
```

### 多账号导出

多账号场景建议显式指定稳定账号标签与账号 ID：

```bash
node scripts/bulk-export-webbridge.js \
  --platform <platform-id> \
  --format md,json \
  --output exports/bulk-YYYY-MM-DD \
  --resume \
  --account-label work \
  --account-id <stable-account-id>
```

## 输出结构

导出结果默认按账号、平台、会话 ID 分层：

```text
exports/bulk-YYYY-MM-DD/
├── manifest.jsonl
├── results.jsonl
├── qa-report.json
└── accounts/<account-slug>/<platform>/<conversation-id>/
    ├── summary.json
    ├── *.md
    └── *.json
```

关键文件说明：

- `manifest.jsonl`：候选会话列表。
- `results.jsonl`：追加式尝试日志，历史失败记录可能在后续恢复成功后仍保留。
- `summary.json`：每个会话的最终状态，应优先用于统计最终导出结果。
- `qa-report.json`：本地审计和网页抽样核对报告。

统计最终结果时，不要只看 `results.jsonl`。应以每个 `summary.json` 以及 `qa-report.json` 为准。

## QA 工具

### 审计本地导出文件

```bash
node /Users/boyaxie/.agents/skills/chatarchive-export/scripts/audit-export.mjs \
  exports/bulk-YYYY-MM-DD \
  --write-report
```

该工具会检查：

- `summary.json`、Markdown、JSON 的消息数量是否一致。
- 是否缺失 Markdown 或 JSON payload 文件。
- 是否仍存在未经确认的 `model` / `models` 断言字段。
- 各平台导出数量、message-bearing 会话数量与零消息候选数量。

### 抽样核对原始网页

```bash
node /Users/boyaxie/.agents/skills/chatarchive-export/scripts/webpage-sample-check.mjs \
  exports/bulk-YYYY-MM-DD \
  --limit 1
```

该工具会通过 Kimi WebBridge 打开导出会话的原网页，并检查首条和末条消息片段是否能在页面正文中找到。工具会自行关闭它创建的 WebBridge session。

如果只想查看抽样计划而不访问网页：

```bash
node /Users/boyaxie/.agents/skills/chatarchive-export/scripts/webpage-sample-check.mjs \
  exports/bulk-YYYY-MM-DD \
  --limit 1 \
  --dry-run-plan
```

## 平台插件与注意事项

平台相关知识已经拆分到两个层次：

- `platforms/*.json`：可执行 metadata，包括平台 ID、默认启用状态、作者别名、URL pattern、起始页面、QA notes。
- `references/platforms/*.md`：面向操作者的平台说明，包括 URL、枚举入口、DOM 注意事项与平台特定排障。

新增平台时，应先添加 `platforms/<platform-id>.json` 和 `references/platforms/<platform-id>.md`，再确认外部 ChatArchive 导出器支持相同的 `--platform` ID。

## 元数据策略

不要把弱页面证据当作已确认的模型使用记录。模型选择器、功能开关、状态 payload 或 UI 标签中出现的模型名，可能只是候选模型或默认值，并不一定对应具体会话轮次。

- 未确认模型信息应保存为 `model_candidates`、`modelCandidates` 或 `modelHints`。
- 只有当页面明确把某个模型归因到具体会话或消息时，才可写入确定性的 `model` / `models` 字段。

## 零消息候选

零消息候选是平台 UI 或网络数据暴露出的 URL，但导出时未抽取到消息内容。它们应被保留以便追踪覆盖范围，但不要计入有内容的对话数量。判断 message-bearing 会话时，以 `summary.summary.messageCount > 0` 为准。

## 排障提示

- WebBridge 命令超时时，可以增加超时时间，例如 `--command-timeout-ms 120000`，并使用同一输出目录恢复。
- 平台特定的枚举或 DOM 问题，应先查看 `references/platforms/<platform-id>.md` 和 `platforms/<platform-id>.json`。
- `results.jsonl` 中存在失败行但所有 `summary.json` 都是 `exported` 时，通常可将失败行视为历史尝试记录。
- 平台未登录时应标记为需要认证并跳过；除非用户主动接管登录，否则不要自动输入凭据。

## 相关文档

- [Skill 入口说明](SKILL.md)
- [Agent 指令](AGENTS.md)
- [完整工作流](references/workflow.md)
- [平台插件索引](references/platforms/README.md)

## License

MIT。见 [LICENSE](LICENSE)。
