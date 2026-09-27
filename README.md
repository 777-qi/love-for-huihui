# 我们的旅行宇宙 💕

只属于天奇和晖晖两个人的小网站：足迹地图、我们的第一次、未来清单、时光胶囊、每日一问、约会转盘。

**线上地址**：<https://777-qi.github.io/love-for-huihui/>（推送 `main` 分支后 GitHub Pages 自动部署）

## 功能一览

| 栏目 | 说明 | 数据 |
|------|------|------|
| 去过的地方 · 足迹 | 中国地图上点亮共同到过的城市，每座城市可补故事和照片 | 云端（kind: `cities`） |
| 我们的第一次 | 时间轴记录值得纪念的第一次，可附照片，可编辑 | 云端（kind: `firsts`） |
| 未来清单 | 想去的地方 / 想吃的店 / 想完成的事，完成后自动进入回忆区 | 云端（kind: `plans`） |
| 时光胶囊 | 写给未来的信，到解锁日期才可见，带署名和倒计时 | 云端（kind: `capsules`） |
| 每日一问 | 两人分别作答，**双方都提交前服务端不下发任何答案**，有往期回顾 | 云端（kind: `daily`） |
| 约会转盘 | 按候选池动态生成扇区，指针精确停在中奖项 | 云端（kind: `wheel`） |

另有：密码门（服务端校验 + 7 天免登录）、在一起计时器（北京时间）、每月 28 日纪念日横幅、每 100 天里程碑、照片灯箱、主页一键导出全部文字备份（JSON）、PWA（可添加到手机主屏幕）。

## 本地开发 / 预览

```bash
node dev-server.mjs
# 打开 http://localhost:8787 ，密码 love-dev-password（仅本地）
```

本地服务器提供与线上一致的三类 API（登录 / 数据 / 照片），数据保存在 `.dev-data/`（已 gitignore），不会碰线上真实数据。

## 云端架构

- **前端**：`index.html` 单文件应用，部署在 GitHub Pages。
- **API**：Netlify Functions（`netlify/functions/`），Netlify 域名 <https://mtqzyh520.netlify.app>，GitHub Pages 前端跨域调用（CORS 锁定 github.io）。
- **数据库**：Supabase `love_memories` 表（`supabase/schema.sql`），只能通过持有 `service_role` 的 Functions 读写，浏览器无法直接访问。
- **照片**：Supabase 私有桶 `love-photos`，读取时由 Functions 签发 1 小时有效的签名 URL。

首次部署 / 升级数据库结构请看 [SUPABASE_SETUP.md](SUPABASE_SETUP.md)。**注意：升级代码后如果新增了数据类型（如 `cities`），需要在 Supabase SQL Editor 重新运行一遍 `supabase/schema.sql`。**

## 备份

主页底部有「⬇ 导出全部回忆」，会把云端全部文字记录打包成 JSON 下载（照片仍在云端私有桶）。原始版本备份在 `backup-original` 分支。
