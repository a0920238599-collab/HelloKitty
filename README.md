# 多人图片产品判断系统

这是一个基于 React + Vite + Express + Supabase 构建的全栈多人图片判断与分配系统。完全符合正式业务部署标准，所有数据安全落地于 PostgreSQL 数据库。

## 一、 核心功能特色

- **完全服务端状态隔离**: 抛弃本地存储，用户数据 100% 同步并保存到 Supabase。
- **并发安全分配**: 采用 PostgreSQL `FOR UPDATE SKIP LOCKED` 的 RPC 事务控制，确保多人同时领取任务时，不会领取到重复数据。
- **动态环境变量集成**: 初始管理员用户名与密码仅通过服务端环境变量注入进行自动初始化，确保敏感信息不在前端代码中泄露。
- **角色权限隔离**: 基于 Supabase RLS，严密防范普通用户越权，普通用户完全无法通过 API 查询公共数据库内容。
- **每日目标激励**: 用户当天完成特定数量的任务，可解锁领取对应的跟卖产品库数据，自动避免重复领取。

## 二、 如何初始化 Supabase 和数据库

1. **创建 Supabase 项目**: 
   前往 [Supabase官网](https://supabase.com/) 新建项目。
2. **获取 API Keys**: 
   在 `Project Settings -> API` 中，找到 `Project URL`、`anon public` 和 `service_role`。
3. **初始化数据库结构**:
   - 打开 Supabase Dashboard 中的 `SQL Editor`。
   - 打开本项目根目录下的 `supabase/setup.sql` 文件，复制其所有内容。
   - 粘贴到 SQL Editor 中并点击 `Run` 运行。
   - 成功后将自动创建所有的业务表、触发器和安全策略（RLS）。
4. **手动创建管理员账号 (重要)**:
   - 去 Supabase 的 Authentication -> Users 中，点击 `Add user` -> `Create new user`。
   - 输入邮箱: `admin@system.local` (系统内部会以此作为初始用户名)。
   - 输入密码。
   - 确保账号被成功创建。
   - **非常重要**: 到 SQL Editor 中，执行以下命令，将刚才创建的账号设置为管理员：
     ```sql
     UPDATE public.profiles SET role = 'admin', is_active = true WHERE username = 'admin@system.local';
     ```

## 三、 环境变量说明 (Vercel & 本地)

无论是在本地 `.env`，还是在 Vercel 的 `Environment Variables` 中，都必须配置以下变量：

```env
# 你的 Supabase Project URL
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
# 你的 Supabase anon/public key (前端可用)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
# 同上，兼容 Vite 环境变量命名
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# 你的 Supabase service_role key (极其机密，只能在后端使用)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# 初始管理员账号与密码 (仅在第一次启动服务端时有效)
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=admin0507
```

## 四、 本地运行步骤

1. 确保已复制并填写完成 `.env` 文件。
2. 运行 `npm install` 安装所有依赖。
3. 运行 `npm run dev` 启动开发服务器。
4. 后台服务启动时，会在终端看到 `Initial admin admin created.` 的日志（前提是 `profiles` 为空）。
5. 访问 `http://localhost:3000`，使用配置的账号密码登录，第一次登录后系统会强制您修改密码。

## 五、 部署到 Vercel (GitHub + Vercel)

本项目使用单一 `server.ts` 提供全栈服务。在 Vercel 部署步骤如下：

1. **推送到 GitHub**: 将代码推送到你自己的私人 GitHub 仓库。
2. **Vercel 导入**: 登录 Vercel，点击 `Add New... -> Project` 导入该仓库。
3. **配置环境变量**: 在部署前，务必展开 `Environment Variables` 面板，将上面的所有 6 个环境变量逐一添加进去。
4. **修改 Build Command (重要)**: 
   默认情况下，Vercel 可能会直接运行构建。我们的 `package.json` 中的 `build` 和 `start` 已经配置好使用 `esbuild` 编译后端并运行。Vercel 支持直接托管 Node 进程，请确保你的入口逻辑正确执行。
5. **点击 Deploy**。部署成功后，系统即自动读取环境变量完成后台初始化。

## 六、 权限越权与并发安全测试步骤

您可以按以下步骤验证系统的强安全性：

1. **管理员导入数据**: 
   管理员登录系统 -> 导入产品 -> 上传提供的 CSV 或 Excel 表格。系统应能过滤重复项。
2. **防并发重复领取测试**: 
   - 打开两个浏览器窗口 (甚至不同电脑)，分别登录普通用户 A 和用户 B。
   - 在两者界面同时点击“获取任务”并请求最大数量。
   - 验证：两者收到的任务清单绝对不会重叠（归功于 PostgreSQL 行级锁定事务）。
3. **越权访问防护测试**: 
   - 以普通用户登录。
   - 打开浏览器开发者工具 (F12) 的 Console 控制台。
   - 执行脚本：`window.supabase.from('products').select('*').then(console.log)`
   - 验证：返回的数据将是一个空数组 `[]`，或者仅包含分配给当前用户的有限几条数据。用户彻底无法窥视公共产品池（归功于 Supabase RLS）。
4. **跟卖产品条件解锁**: 
   - 管理员在“系统设置”将门槛设为 5（为方便测试）。
   - 用户判断并提交 5 条为“是”的任务。
   - 点击领取跟卖产品，验证系统顺利分配未被其认领过的跟卖数据，且公共库中产品不被删除。
