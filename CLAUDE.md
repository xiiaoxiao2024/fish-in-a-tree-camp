# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目说明

Fish in a Tree 英文共读营系统。学生通过手机（微信）打开每日任务卡阅读、做词汇游戏、拍照上传写作作业；老师在后台查看提交、写批改反馈。

## 启动命令

```bash
# 启动服务（端口 3456）
node server.js

# 开启公网隧道（另开终端）
npx localtunnel --port 3456 --subdomain fish-in-a-tree-camp
```

访问地址见 `links.md`。

## 架构

**`server.js`** — Express 服务，3 个 API + 静态文件托管：
- `POST /api/submit` — 学生提交（multer 接收图片，存 `data/uploads/`，写入 `data/submissions.json`）
- `GET /api/submissions` — 老师后台拉取全部提交
- `POST /api/feedback/:id` — 老师保存批改内容 / 标记已完成
- 静态目录：`public/`（前端页面）、`data/uploads/`（提交的照片）

**`public/day1.html`** — 学生端任务卡（每天一份）。结构：顶部姓名栏（localStorage 持久化）→ 今日阅读打卡 → 单词闪卡 → 今天看点（视频占位） → 今日写作（词库 + 句型 + 拍照上传） → 老师的话。

**`public/admin.html`** — 老师后台。纯前端，轮询 `/api/submissions`（每 30 秒），支持按 Day / 批改状态筛选，图片点击放大，行内保存反馈。

**`data/submissions.json`** — 唯一持久化存储，数组，最新提交在最前。字段：`id / studentName / day / photoPath / submittedAt / feedback / reviewed`。

## 关键实现细节

**单词发音**：优先调用有道词典真人发音 `https://dict.youdao.com/dictvoice?audio=WORD&type=2`（type=2 = 美音），失败后回落 Web Speech API。微信内置浏览器的 `speechSynthesis` 不可靠，不要作为主路径。

**拍照上传**：`<input type="file" accept="image/*" capture="environment">` 在手机上唤起相机。上传通过 `FormData` POST 到 `/api/submit`，multer 限制 20MB。

**视频区**：`public/day1.html` 中视频区目前是占位符（`.video-placeholder`）。上传视频后将 `<div class="video-placeholder">` 替换为 `<video src="URL" controls>` 即可。

**新增每日任务卡**：复制 `public/day1.html` 为 `public/day2.html`，修改 header 日期、章节列表、单词闪卡（6个词 + `flipCard(this,'WORD')`）、写作 Prompt、Word Bank、老师的话。`day` 字段在提交时从页面传入（`form.append('day', '2')`）。

## 内容计划

`week1_content_plan.md` — 第一周（7/1–7/7）每日阅读范围、写作题目、批改要点。共 51 章，两周读完。
