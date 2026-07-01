# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目说明

Fish in a Tree 英文共读营系统。学生通过手机（微信）打开每日任务卡，阅读章节、听朗读音频、做词汇闪卡、拍照上传写作作业；老师在后台查看提交、写批改反馈。

**营期：** 7/1–7/14，共 13 天（7/12 周日休息），51 章。
- 第一周：Day 1–7（7/1–7/7，Ch. 1–25）
- 第二周：Day 8–13（7/8–7/14，跳过 7/12 周日，Ch. 26–51）

## 启动命令

```bash
# 本地开发（端口 3456，用 JSON 文件存储）
node server.js

# 公网访问（cloudflared，无 interstitial，微信可正常爬取 OG 标签）
cloudflared tunnel --url http://localhost:3456
```

**已部署到 Render：** `https://fish-in-a-tree-camp.onrender.com`（见 `links.md`）

## 架构

### server.js — 双模式 Express 服务

`USE_DB = !!process.env.DATABASE_URL` 控制运行模式：

| 模式 | 触发条件 | 图片存储 | 提交存储 |
|---|---|---|---|
| 本地 | 无 `DATABASE_URL` | `data/uploads/` 磁盘 | `data/submissions.json` |
| Render | 有 `DATABASE_URL` | PostgreSQL base64 | `submissions` 表 |

**重要：** `app.set('trust proxy', 1)` 必须保留。Render 在负载均衡层终止 SSL，没有这行 `req.protocol` 会返回 `http`，导致 OG 图片 URL 变成 `http://`，微信无法显示卡片封面。

**API：**
- `POST /api/submit` — multer 接收图片（20MB 限制），DB 模式存 base64，本地模式存磁盘
- `GET /api/submissions` — 返回全部提交，DB 模式 photoPath 为 `/api/photo/:id`
- `GET /api/photo/:id` — 仅 DB 模式，从 pg 读 base64 返回图片
- `POST /api/feedback/:id` — 保存 feedback / reviewed 字段

**Day 页面动态注入：** `app.get(/^\/day\d+\.html$/, ...)` 拦截所有 dayN.html 请求，将文件中的 `__OG_BASE__` 替换为实际的 `https://hostname`，使 OG 标签在任何部署域名下都正确。其余静态文件直接由 `express.static` 托管。

### public/dayN.html — 学生端任务卡（Day 1–13）

每天一个文件，结构固定：

1. **Header** — Day 编号、日期、章节主题
2. **名字栏** — `localStorage` 持久化，所有提交带上学生姓名
3. **今日阅读** — 章节列表，点击打卡（纯前端状态，不持久化）
4. **朗读音频** — 自制音频播放器，章节 tab 切换，src 指向 `/audio/chapterN.mp3`
5. **单词闪卡** — 2×3 grid，点击翻转 + 调用有道词典发音
6. **今日写作** — Prompt + Word Bank + 句型起点 + 拍照上传
7. **老师的话** — 静态文字，每天不同

**新增一天：** 复制 `day1.html` → `dayN.html`，修改 header 信息、章节列表、音频 tabs（`CHAPTERS` JS 对象 + `loadChapter` tab 按钮）、vocab 卡片、writing prompt、word bank、starters、teacher text，以及 `form.append('day', 'N')`。OG 标签里的 `__OG_BASE__` 不用改，服务器自动替换。

### public/admin.html — 老师后台

纯前端，轮询 `GET /api/submissions`（30 秒），支持按 Day / 批改状态筛选，图片点击放大，行内输入框保存反馈，`POST /api/feedback/:id`。

### public/audio/ — 章节朗读 MP3

用 Google Cloud TTS（`en-US-Journey-F`，语速 0.95）生成，需要通过 `127.0.0.1:7897` 代理。
生成脚本在 scratchpad，章节行号范围：

```
Ch1(162,266) Ch2(266,354) Ch3(354,454) Ch4(454,604)
Ch5(604,696) Ch6(696,788) Ch7(788,834) Ch8(834,910)
Ch9(910,1090) Ch10(1090,1182) Ch11(1182,1292) Ch12(1292,1390)
Ch13(1390,1460) Ch14(1460,1578) Ch15(1578,1700) Ch16(1700,1740)
Ch17(1740,1846) Ch18(1846,1944) Ch19(1944,2100) Ch20(2100,2228)
Ch21(2228,2312) Ch22(2312,2350) Ch23(2350,2396) Ch24(2396,2512)
Ch25(2512,2584)
Ch26(2584,2654) Ch27(2654,2732) Ch28(2732,2830) Ch29(2830,3012)
Ch30(3012,3062) Ch31(3062,3144) Ch32(3144,3252) Ch33(3252,3310)
Ch34(3310,3452) Ch35(3452,3550) Ch36(3550,3602) Ch37(3602,3688)
Ch38(3688,3754) Ch39(3754,3899) Ch40(3899,3939) Ch41(3939,4057)
Ch42(4057,4187) Ch43(4187,4225) Ch44(4225,4291) Ch45(4291,4355)
Ch46(4355,4445) Ch47(4445,4596) Ch48(4596,4714) Ch49(4714,4754)
Ch50(4754,4884) Ch51(4884,5125)
```

书的文本文件：scratchpad 目录下 `fish_in_a_tree.txt`（5125 行）。
TTS 必须通过代理：`curl -x http://127.0.0.1:7897`，不能用 `--noproxy`。
gcloud 认证需要 quota project：`gcloud auth application-default set-quota-project gen-lang-client-0474546891`

## 关键实现细节

**单词发音：** 优先 `https://dict.youdao.com/dictvoice?audio=WORD&type=2`（美音），失败回落 Web Speech API。微信内置浏览器 `speechSynthesis` 不可靠，不做主路径。

**WeChat 卡片分享：** 直接粘贴 URL 只显示文字链接。要发卡片：在微信浏览器打开链接 → `···` → 发送给朋友 → 选群。og:image 必须是 `https://` 才能被微信加载（trust proxy 问题已修复）。

**Render 数据库：** 复用 `howie-learning-db`（PostgreSQL Free），不能新建第二个免费 DB。`DATABASE_URL` 环境变量指向该 DB，`submissions` 表在服务启动时自动 `CREATE TABLE IF NOT EXISTS`。

**内容计划：**
- `week1_content_plan.md` — Day 1–7 每日章节范围、写作题目、批改要点
- `每日群文案.docx` — Day 1–13 完整微信群发文案（含链接），7/12 周日休息日单独插入

**Day 页面生成脚本（scratchpad）：**
- `gen_days2.py` — 生成 Day 2–7
- `gen_week2.py` — 生成 Day 8–13

**音频生成注意事项：** gcloud token 约 1 小时过期（401 UNAUTHENTICATED），长章节分多 chunk 时易过期。脚本已跳过已存在文件，过期后直接重跑即可续跑。
