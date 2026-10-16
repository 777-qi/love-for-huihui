# 我们的旅行宇宙 💕

只属于天奇和晖晖两个人的小网站，**纯静态零维护**：所有内容写在代码里，照片放进文件夹就自动显示，不需要任何服务器、数据库或账号。

**线上地址**：<https://777-qi.github.io/love-for-huihui/>（推送 `main` 分支后 GitHub Pages 自动部署）

## 怎么改内容（唯一的入口）

打开 `index.html`，找到最顶部的 **`SITE` 对象**（约 30 行处），所有栏目的文字都在那里：

| 想改什么 | 改哪里 |
|------|------|
| 城市、城市故事 | `SITE.cities` |
| 「我们的第一次」条目 | `SITE.firsts` |
| 未来清单愿望 | `SITE.plans`（`done: true` 自动进回忆区） |
| 时光胶囊（给未来的信） | `SITE.capsules`（到期前只显示倒计时） |
| 话题卡题库 | `SITE.topics`（每天自动轮换一张） |
| 约会转盘选项 | `SITE.wheel` |
| 在一起的日期 | `SITE.since` |
| 进入密码 | `SITE.passwordHash`（见下方） |

改完保存、提交推送即可，一分钟后生效。

## 怎么放照片（零代码）

把照片放进 `images/` 对应文件夹，按 `拼音-序号.jpg` 命名（如 `beijing-1.jpg`），网页自动显示；删掉文件照片就消失。每个文件夹里有说明文件。

- `images/cities/` → 城市照片（`beijing-1.jpg`，每城最多 8 张）
- `images/firsts/` → 第一次的照片（`f1-1.jpg`，id 对应 `SITE.firsts`）
- `images/capsules/` → 胶囊照片（`c1-1.jpg`，解锁日才可见）

## 修改进入密码

默认密码是 `20240228`。换密码跑这一行，把输出替换进 `SITE.passwordHash`：

```bash
node -e "console.log(require('crypto').createHash('sha256').update('新密码').digest('hex'))"
```

输入正确后 7 天内免重复输入。

## 本地预览

```bash
node dev-server.mjs   # 打开 http://localhost:8787
```

（也可以直接双击用浏览器打开 `index.html`。）

## 栏目一览

足迹地图（14 城点亮）· 我们的第一次（时间轴）· 未来清单 · 时光胶囊（倒计时+到期开信）· 今日话题（每天轮换+话题卡）· 约会转盘（扇区动态生成、指针精确落点）· 在一起计时器 · 每月 28 日纪念日横幅 · 每 100 天里程碑 · 照片灯箱 · 手机可添加到主屏幕（PWA）。

> 历史版本：之前的云端上传版（Netlify + Supabase）保存在 git 历史的 `backup-original` 等旧提交中，随时可以找回。
