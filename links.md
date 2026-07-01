# Fish in a Tree 共读营 · 访问链接

## 学生端（发到微信群）
https://separate-builder-consolidated-political.trycloudflare.com/day1.html

## 老师后台
https://separate-builder-consolidated-political.trycloudflare.com/admin.html

---

## 本地地址（同一 WiFi 下可用）
- http://localhost:3456/day1.html

## 启动方式（每次开电脑后运行）
```bash
# 终端 1 — 启动服务
cd ~/Desktop/fish\ in\ a\ tree && node server.js

# 终端 2 — 开启公网隧道（URL 固定需注册 Cloudflare 账号，否则每次不同）
cloudflared tunnel --url http://localhost:3456
```

> 当前隧道 URL（每次启动可能变化）：https://separate-builder-consolidated-political.trycloudflare.com
> 若需固定 URL，可注册免费 Cloudflare 账号绑定域名。
