---
title: "用 OpenUI 在 Loop 中实现 ChatGPT 式 Intelligent UI"
summary: "用十个浏览器实测场景拆解 Loop 的 OpenUI 集成，涵盖路线地图、图文指南、计时、用量换算、图片搜索、销售分析和鼓机。"
author: Di
category: engineering
publishedAt: 2026-11-28
draft: false
---

向 Loop 提供一组访问量，回复里可以直接显示图表。比较几个方案时，回复可以把价格和交付周期排成表格，并提供可点的追问。需要收集偏好时，用户可以在消息里选好并提交。本文用 Intelligent UI 指这类随对话生成、可直接操作的界面，并拆解 Loop Web 和 Desktop 如何通过 OpenUI 实现它。

截图来自 Loop 的真实聊天组件，使用固定的虚构消息在浏览器中验证。可以在自己的会话里试用下面的提问，实际界面取决于模型的回复。前三个案例附有 OpenUI Lang 示例，后七个案例提供可直接粘贴的提问和浏览器验收结果。

## 1. 看趋势：悬停查看周三的数据

在聊天框里输入「周一到周五的访问量是 12、19、16、24、28。哪天回落了，整体趋势如何？」回复指出周三从 19 降到 16，随后回升到周五的 28。把鼠标移到周三的柱上，工具提示就会显示当天的访问量 16。

![访问趋势图，鼠标停在周三的柱上，提示显示访问量 16](./trend-zh-light.webp)

柱图的横轴标签和数值由 `BarChart` 和 `Series` 接收，悬停提示由 React 图表组件在浏览器中处理。每次移动鼠标都可以读取对应的数据点，无需发出新消息。

~~~~markdown
```openui
root = Stack([BarChart(["周一", "周二", "周三", "周四", "周五"], [Series("访问量", [12, 19, 16, 24, 28])])])
```
~~~~

## 2. 比方案：从表格里选一条追问

在聊天框里输入「比较三个虚构方案。基础版 29 元、5 天交付、邮件支持；标准版 49 元、2 天交付、邮件支持；加急版 79 元、1 天交付、优先支持。」表格把价格、交付时间和支持方式排在同一行，方便逐列比较。点击下方的「只比较两天内交付的方案」，Loop 会将这句话作为一条用户消息发送。

![三个方案的对比表，包含价格、交付时间和支持方式，表格下方有追问按钮](./comparison-zh-light.webp)

`Table([Col(...)])` 按列接收数据，各列相同位置的值组成一行。`FollowUpItem` 则把按钮文案交给聊天提交流程。点击会开始下一轮对话，表格仍保留在原回复中。

~~~~markdown
```openui
root = Stack([comparison, followups])
comparison = Table([Col("方案", ["基础版", "标准版", "加急版"]), Col("价格", ["¥29", "¥49", "¥79"]), Col("交付", ["5 天", "2 天", "1 天"]), Col("支持", ["邮件", "邮件", "优先"])])
followups = FollowUpBlock([FollowUpItem("只比较两天内交付的方案")])
```
~~~~

## 3. 选偏好：提交每周报告设置

在聊天框里输入「让我在每周和每月之间选一个发送频率，再推荐合适的报告格式。」选中「每周」，再点「应用」。选择选项时只更新表单状态。点击后，聊天会出现一条新消息「按这个频率推荐报告格式」。

![报告偏好表单已选中每周，下面的用户消息显示点击应用后发送的文字](./preferences-zh-light.webp)

`Chips` 为每个选项定义稳定值和显示标签。`@ToAssistant` 提供用户气泡中的文字。下一轮输入还包含独立的结构化表单数据，例如字段名 `frequency`、字段标签「发送频率」、原始值 `weekly` 和显示值「每周」。因此即使按钮文案只说「这个频率」，模型也能拿到明确的选择。

~~~~markdown
```openui
root = Stack([Form("report", actions, [frequency])])
actions = Buttons([Button("应用", @ToAssistant("按这个频率推荐报告格式"))])
frequency = FormControl("发送频率", Chips("frequency", "single", [weekly, monthly]))
weekly = ChipItem("weekly", "每周")
monthly = ChipItem("monthly", "每月")
```
~~~~

## 4. 路线地图：按需查询步行路线

```text
请在回复里做一张互动地图，按台北车站、二二八和平公园、总统府的顺序标点。我要能拖动、缩放、点击景点，并按需查询步行路线。
```

拖动地图后用加减按钮缩放，点击 2 号标记查看二二八和平公园，再点击「查找步行路线」。三个站点保持原顺序，绘制路线前后的标记位置一致。

![台北三个站点及查询后绘制的步行路线](./route-map-zh-light.webp)

`RouteMap` 接收按顺序排列的公开地标坐标。MapLibre 在卡片接近视口后加载底图。点击查询才将站点坐标发送给 FOSSGIS，返回的 GeoJSON 线更新现有地图图层，因此查询不会重新定位视角。

底图使用 OpenFreeMap，地图数据 © OpenStreetMap 贡献者，步行路线由 FOSSGIS 提供。[OpenFreeMap](https://openfreemap.org/) · [OpenStreetMap 授权](https://www.openstreetmap.org/copyright) · [FOSSGIS 路线服务](https://routing.openstreetmap.de/)

## 5. 图文指南：翻页和切换书架版本

```text
做一份可翻页的桌面书架安装指南，提供单层和双层两个版本。每个版本用三幅线条图展示对齐、装入层板、检查方正。
```

在单层版点「下一步」观察线条图变化，再切到「双层」，此时回到第 1 步。继续翻到「检查方正」，可看到对角线。

![双层书架第三步，示意图中的对角线用于检查方正](./step-guide-zh-light.webp)

`StepGuide` 把版本和步骤作为结构化数据，每一步持有说明和 SVG 路径。组件按步骤绘制线条图，切换版本时在本地重置步骤索引。

## 6. 倒计时与 Markdown：计时卡和步骤一起显示

```text
给我一份手冲咖啡指南。开头保留 **准备：**15 克咖啡粉 的紧接数字写法，在闷蒸步骤旁放一个可开始、暂停和重置的 12 秒测试倒计时。
```

「**准备：**15 克咖啡粉」中的标签仍然加粗，闷蒸步骤和计时器一起显示。点击「开始」，倒数到 11 秒时暂停，再点「重置」回到 12 秒。

![回复保留加粗准备标签，闷蒸测试计时器暂停在 11 秒](./countdown-zh-light.webp)

`AssistantContent` 将围栏前的文字交给 Markdown 渲染器，中文冒号紧接数字的加粗写法由 Markdown 的 CJK 处理逻辑识别。`Countdown` 接收秒数，开始、暂停和重置都由浏览器处理。这里的 12 秒只用于测试控件。

## 7. 用量换算：把 2 人份调成 5 人份

```text
做一份 2 人份燕麦早餐购物清单，含 100 克燕麦、300 毫升牛奶和 20 克蜂蜜。让我在回复里用滑块调整份数，立即换算。
```

将滑块从 2 调到 5，清单立即更新为 250 克燕麦、750 毫升牛奶和 50 克蜂蜜。聚焦滑块后也能用方向键调整。

![燕麦早餐清单调到 5 人份后的三项用量](./scaled-list-zh-light.webp)

`ScaledList` 接收基准份数和每种食材的基准用量。每次滑动都按「基准用量 × 当前份数 ÷ 基准份数」计算，单位保持原样。

## 8. 图片搜索：打开庭院照片的来源

```text
做一张日式庭院灵感板，给出石材、苔藓和竹篱的搭配建议，并提供一个按钮，从 Wikimedia Commons 查找相关参考图片。
```

先看石材、苔藓和竹篱的配色，再点「在维基共享资源中查找图片」。结果在卡片里显示缩略图，点击结果可打开对应的 Wikimedia Commons 文件页。

![庭院灵感板包含三种色样、Commons 搜索按钮与带来源的照片缩略图](./image-search-zh-light.webp)

`ColorSwatch` 显示色值和建议用途。`SearchImage` 在点击后才发送查询词，并校验缩略图与来源链接的域名。截图中的照片来自实际搜索结果。

截图照片按显示顺序授权如下。

- Daderot，CC0。[DSC00327](https://commons.wikimedia.org/wiki/File:Stone_and_moss_-_Nagamachi_-_Kanazawa,_Japan_-_DSC00327.jpg) · [DSC00324](https://commons.wikimedia.org/wiki/File:Stone_and_moss_-_Nagamachi_-_Kanazawa,_Japan_-_DSC00324.jpg)
- Sherwin John Carlquist，CC BY 4.0。[Moss-covered stone sculpture](https://commons.wikimedia.org/wiki/File:%28Moss-covered_stone_sculpture_in_Sh%C5%8Dy%C5%8D-en_Garden,_Japan%29_-_DPLA_-_6b96501ada4b955821f774286da0b41f.jpg) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Z3lvs，CC0。[Stone lantern](https://commons.wikimedia.org/wiki/File:Stone_lantern,_stepping_stones_and_Japanese_maple_on_a_moss_lawn,_Portland_Japanese_Garden.jpg) · [Raked gravel](https://commons.wikimedia.org/wiki/File:Raked_gravel_and_moss-covered_stones,_Sand_and_Stone_Garden,_Portland_Japanese_Garden.jpg) · [Gravel court](https://commons.wikimedia.org/wiki/File:Gravel_court_with_moss-covered_stones,_Sand_and_Stone_Garden,_Portland_Japanese_Garden.jpg)

## 9. 销售仪表盘：调低 20% 查看预计总额

```text
用 Loop 内置的模拟销售数据做一个仪表盘。先画一张按月显示实际营收的柱状图，再加一个能即时调整预计营收的百分比滑块。
```

先看 1 到 6 月的实际营收柱状图，再把滑块设到 −20%。柱状图仍显示实际营收，预计总额更新为 67,360 美元，下方表格逐月列出实际值和预计值。

![实际月度营收柱状图和调整至负 20% 后显示 67,360 美元的预计总额](./sales-dashboard-zh-light.webp)

`Query("loop_demo_sales", {})` 读取 Loop 内置的虚构销售数据，`BarChart` 和 `SalesScenario` 共享同一份月度数据。预计总额按 84,200 × 0.8 得出，滑块变化只重算本地预测。

## 10. 鼓机：编辑并播放 16 步节奏

```text
在回复里放一个 16 步鼓机，初始速度 108 BPM，带底鼓、军鼓、踩镲、摇摆滑块和播放按钮。让我能编辑节奏，也能单独敲击每种鼓。
```

鼓机以 108 BPM 打开。点击三行中的格子编辑节奏，也能单独试听底鼓、军鼓或踩镲。点击「播放」可看到当前拍在 16 列间移动，点击「停止」后高亮消失。

![108 BPM 的鼓机正在播放，三行各有 16 个可编辑格子](./drum-lab-zh-light.webp)

`DrumLab` 在浏览器中维护三个轨道的步进状态。用户点击后才启动 Web Audio，按速度和摇摆值安排发声时间，并同步更新播放高亮。

## 11. 让生成和渲染共享组件定义

Loop 使用 `@openuidev/react-lang` 的解析器和 React 渲染器，以及 `@openuidev/react-ui` 的官方组件。共享库以独立组件库为基础，再补入追问按钮等聊天组件。后端从 `toSpec()` 读取组件签名，前端用 `toJSONSchema()` 和根组件配置建立解析器。两端由同一份定义约束组件名、参数顺序和根节点。[OpenUI 源码](https://github.com/thesysdev/openui)

Web 后端通过 SDK 的 `additionalTools` 注册只读工具 `load_openui_docs`。工具描述引导模型按意图选组件：趋势用图表，多维比较用表格，收集偏好用表单。简单问答可以直接返回 Markdown。每次工具调用只加载一个主题的签名、规则和示例，例如 `{"topic":"charts"}`。按主题加载可以把组件手册留在模型确实需要的那一轮上下文里。

## 12. 从文本增量渲染并从历史重建

助手回复仍是文本流。`AssistantContent` 识别其中顶层的 `openui` 围栏，将围栏前后的文字交给 Markdown 渲染器。首次遇到可渲染的块才加载 `OpenUiCard` 及其样式。最新文本片段末尾的围栏在生成期间即使还没闭合，也可以随增量预览。

回复结束时，解析器检查根节点、引用和错误。未闭合、无效或渲染失败的内容保留为可读源码。历史保存原始助手消息，重新打开会话时可重建组件。表单提交记录随用户消息保存，卡片重新挂载时会重新初始化本地控件状态。

## 13. 把界面交互接入会话边界

图表悬停和表单选项切换留在浏览器。追问和表单提交复用当前会话的消息入口，要求会话已连接且可发送。基础图表、表格和表单可以直接使用消息里的数据。渲染器只允许通过 `Query` 读取内置的虚构销售数据，并拒绝 `Mutation`。若下一轮需要调用工具，仍通过 Agent 的常规工具与权限流程。
