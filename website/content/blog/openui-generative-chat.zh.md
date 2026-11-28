---
title: "从 Markdown 到交互界面：Loop 如何集成 OpenUI"
summary: "用图表和表单示例拆解 Loop 的 OpenUI 集成，涵盖组件选择、流式渲染、会话提交与历史回放。"
author: Di
category: engineering
publishedAt: 2026-11-28
draft: false
---

在 Loop 中问「周一到周五的访问量是 12、19、16、24、28，哪天回落了，整体趋势如何？」模型可以在一段文字解释旁生成图表。用户也可以在回复里直接选择偏好并提交，下一轮回答便能用这些选择继续工作。这是生成式 UI 的交互方式：同一个聊天入口可以根据问题呈现不同界面。本文介绍 Loop Web 和 Desktop 当前开发版本的实现。

## 1. 复用 OpenUI 的语言和组件库

Loop 从 OpenUI 仓库引入两个包。`@openuidev/react-lang`（1.2.0）提供 OpenUI Lang 的解析器和 React 渲染器。`@openuidev/react-ui`（0.20.1）提供图表、表格、表单、布局组件及其样式。Loop 以官方独立组件库为底，再补入聊天组件库中同名组件尚未注册的部分。这样同一个 `Stack` 可以同时容纳图表、表单和后续追问按钮。[OpenUI 源码](https://github.com/thesysdev/openui)

共享组件库定义在 `packages/web-ui/src/shared/openui-library.ts`。后端用它的 `toSpec()` 获取组件签名，前端用 `toJSONSchema()` 和根组件配置建立解析器。生成侧和渲染侧从同一份定义获取组件名、参数顺序和根组件约束，升级依赖时也由这份定义同步变化。

## 2. 让模型按用户意图选择界面

Web 后端在创建 Loop 实例时，通过 SDK 的 `additionalTools` 注册只读工具 `load_openui_docs`。工具描述向模型说明如何选组件。趋势和异常值适合图表，多维度比较适合表格，需要用户选择偏好时可以用表单。简单问答继续使用 Markdown。

工具一次返回一个主题的组件签名、生成规则和示例，例如调用 `{"topic":"charts"}`。首次调用时加载共享组件库，之后按主题缓存文档。常规问答的初始上下文只需包含工具定义，组件签名按需进入会话。数据来自用户输入或 Agent 已取得的工具结果。

例如，模型可以先指出周三从 19 回落到 16，再输出下面这个顶层 `openui` 代码块。根节点是 `Stack`，每行定义一个表达式，组件按签名接收位置参数。复制示例时保留外层代码围栏。

~~~~markdown
```openui
root = Stack([chart])
chart = BarChart(["周一", "周二", "周三", "周四", "周五"], [Series("访问量", [12, 19, 16, 24, 28])])
```
~~~~

## 3. 在文本流里渲染组件

`AssistantContent` 用 Markdown 解析结果识别顶层 `openui` 块，前后的内容仍走 Markdown 渲染。遇到首个可渲染的块才加载 `OpenUiCard` 和 OpenUI 样式。当最新的文本片段仍在生成时，末尾尚未闭合的块可以预览，界面随文本增量更新。

回复结束时，解析器检查根节点、未解析的引用和语法错误。缺少闭合围栏、结构不完整或渲染失败时，聊天保留原始代码供阅读和复制。会话历史也保存原始助手消息，重新打开会话便可据此重建界面。表单提交记录随消息保存，卡片挂载时重新初始化本地控件状态。

## 4. 把表单提交送回会话

偏好表单可以让用户选择报告的发送频率。按钮上的 `@ToAssistant` 提供要发送的消息，`Chips` 的选项同时定义稳定值和可读标签。

~~~~markdown
```openui
root = Stack([Form("report", actions, [frequency])])
actions = Buttons([Button("应用", @ToAssistant("按这个频率推荐报告格式"))])
frequency = FormControl("发送频率", Chips("frequency", "single", [weekly, monthly]))
weekly = ChipItem("weekly", "每周")
monthly = ChipItem("monthly", "每月")
```
~~~~

选择「每周」再点「应用」，聊天气泡显示「按这个频率推荐报告格式」。模型还会收到一块单独的用户输入，其中包含表单名、字段名 `frequency`、字段标签「发送频率」、原始值 `weekly` 和显示值「每周」。后续追问按钮则发送普通用户消息。提交复用当前会话的消息入口，要求会话已连接且处于可发送状态。

## 5. 划清渲染与执行的边界

OpenUI 可以用消息中已有的数据渲染图表、表格和本地筛选器。Loop 会拒绝包含 `Query` 或 `Mutation` 声明的块，生成规则也要求模型避免 `@Run`。点击链接时，应用只接受不带认证信息的绝对 HTTP(S) URL。表单提交本身是用户消息，下一轮若需要调用工具，仍通过 Agent 的常规工具与权限流程。

验证这条链路时可以分别检查三处：同一个 `openui` 块能否随文本流出现并从历史重建，坏块能否保留为可读源码，以及选项的原始值和显示标签能否一起进入下一轮请求。Loop 的相关覆盖位于 `OpenUiCard.test.tsx`、`openui-blocks.test.ts` 及 Web 后端的 `loop.test.ts`。
