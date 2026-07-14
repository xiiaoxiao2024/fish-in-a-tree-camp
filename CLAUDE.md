# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目说明

Fish in a Tree 英文共读营系统。学生通过手机（微信）打开每日任务卡，阅读章节、听朗读音频、做词汇闪卡、拍照上传写作作业；老师在后台查看提交、写批改反馈。

**营期：** 7/1–7/14，共 13 天（7/12 周日休息），51 章。
- 第一周：Day 1–7（7/1–7/7，Ch. 1–25）
- 第二周：Day 8–13（7/8–7/14，跳过 7/12 周日，Ch. 26–51）

### 第二期：Frindle 共读营（2026-07-13 起筹备，2026-07-14 任务卡开发）

书名 *Frindle*（Andrew Clements），Lexile 830L，**实际全书 15 章**（原计划写的 20 章是筹备期估计，海报文案定稿前已核实 epub 目录只有 15 章，以此为准），营期 7 天（7/15–7/21）。适合年级沿用第一期同一批学生（4-6年级），不单独标注。

epub 源文件：项目根目录 `Frindle (Clements Andrew) (z-library.sk, 1lib.sk, z-lib.sk).epub`（单文件 HTML，`<p class="ChapterTitle">` 标记章节）。章节纯文本已拆分到 scratchpad `frindle_text/ch01.txt`...`ch15.txt`，供写作提示/词汇/TTS 取材。

**7 天分日安排（已按实际 15 章 + 词数配平 + 剧情节点定稿）：**
- Day 1「认识 Nick / Mrs. Granger」Ch1-2（1807 words）— 人物出场，"The Lone Granger" 外号
- Day 2「问题 / 词侦探」Ch3-4（1225 words）— Nick 的拖堂问题引来查字典报告的作业
- Day 3「报告 / 大主意」Ch5-6（2662 words）— 课堂报告 + frindle 一词诞生（Mrs. Granger: "Who says dog means dog? You do, Nicholas."）
- Day 4「文字大战」Ch7-9（2705 words）— frindle 传开，Mrs. Granger 反击，全班罚抄
- Day 5「新闻自由」Ch10-11（1918 words）— 校报/镇报报道
- Day 6「电波 / 涟漪」Ch12-13（3064 words）— 全国电视新闻，Bud Lawrence 商业化
- Day 7「Nick 的内心 / 结局」Ch14-15（2664 words）— 压力与和解，十年后彩蛋，结营写 150-200 词书评

**URL 命名空间（避免和第一期撞名）：** 任务卡放在 `public/frindle/day1.html`...`day7.html`（不是根目录 `dayN.html`，那是第一期占用的）。`day` 表单字段用 `F1`...`F7` 区分提交记录，`server.js` 的 OG 注入正则和 `admin.html` 的 day 排序/筛选逻辑相应扩展以兼容两期共存。音频放 `public/frindle/audio/chapterN.mp3`（1-15）。配色用海报同款靛蓝 `#3949AB`，区别于第一期森林绿。

招生海报（长图）**不放在本项目目录**，生成在 `~/Desktop/社群/长图-Frindle.png`，源配置在该文件夹的 `generate_posters.py`（`POSTERS` 列表最后一项，accent `#3949AB` 靛蓝）。该脚本是社群多本共读书目共用的海报生成器（PIL 绘制，非 Playwright 截图），改内容后重新 `python3 generate_posters.py` 会连同其他书目一起重绘。

**不要与 `~/Desktop/社群/长图-Fish-in-a-Tree.png` 混淆**：那是同一本书的另一种付费书友群模式（2周4次书面作业，¥79，无每日任务卡/音频/词汇闪卡），跟本项目的每日互动任务卡是两套并行的商业形态，字段结构不能互相套用。

海报文案要点（用户明确要求）：不提“衔接 Fish in a Tree”，不出现 Rangel 品牌落款，不提“同伴互评”“结营证书”。

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

**⚠️ CHAPTERS 标题里章节名含撇号必须转义：** `CHAPTERS` 对象的 `title` 字段是单引号 JS 字符串。章节标题若含直引号撇号（如 `What's`、`I've`），会提前闭合字符串导致整个 `<script>` 块语法错误——不只是音频播放器，闪卡、拍照上传全部失效（同一脚本块）。day3（Ch.12 `What's`）、day4（Ch.16 `I've`）都踩过这个坑。**修法：** 用 `\'` 转义，或者干脆用弯引号 `'`（day12/13 已用 `'` 且安全）。新增/修改任何一天后，用以下命令批量检查全部 dayN.html 的 script 是否能正常解析：
```bash
for f in public/day*.html; do node -e "
  const fs = require('fs');
  const html = fs.readFileSync('$f', 'utf8');
  [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m,i) => {
    try { new Function(m[1]); } catch (e) { console.log('$f', i, e.message); }
  });
"; done
```

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
