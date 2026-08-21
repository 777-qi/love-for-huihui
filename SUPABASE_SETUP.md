# Supabase 共享存储配置

网站代码已经使用 Netlify Functions 保护数据库密钥。完成以下配置后，双方打开同一网站即可看到相同内容。

## 1. 初始化 Supabase

1. 创建一个 Supabase 项目。
2. 打开项目的 SQL Editor。
3. 完整运行 [`supabase/schema.sql`](supabase/schema.sql)。
4. 打开左侧 Storage；如果还没有 `love-photos`，创建一个名为 `love-photos` 的私有 bucket，单文件上限设为 2MB。
5. 在 Project Settings / API 中取得 Project URL 和 `service_role` key。

`service_role` 拥有高权限，只能放在 Netlify 环境变量里，不能写进 `index.html`、不能提交到 Git，也不要发给其他人。

## 2. 配置 Netlify 环境变量

在 Netlify 项目的 Environment variables 中新增：

- `SUPABASE_URL`：Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase `service_role` key
- `LOVE_PASSWORD`：双方进入网站时输入的密码
- `SESSION_SECRET`：随机长字符串，建议至少 32 个字符

保存变量后重新部署网站。旧变量只在新部署的 Functions 中生效。

## 3. 迁移旧数据

首次在原来保存过内容的浏览器中登录时，网页会自动把 IndexedDB 与 localStorage 中的旧内容上传到 Supabase。数据以原有 ID 写入，多次重试不会创建重复记录。

迁移成功后，刷新另一台手机或浏览器即可看到相同内容。
