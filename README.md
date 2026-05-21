# TodoList

简易全栈待办：Vue 3 + Express + MySQL，前后端通过 Vite 代理联调。

## 目录

- `client/` — 前端（http://localhost:5173）
- `server/` — 后端 API（http://localhost:3000）
- `docker-compose.yml` — 可选，启动 MySQL

## 启动

### 1. MySQL

**Docker：**

```bash
docker compose up -d
```

**或本机 MySQL：** 创建库 `todolist`，用户密码与 `server/.env` 一致。

| 配置项 | 默认值 |
|--------|--------|
| 主机 | 127.0.0.1:3306 |
| 库名 | todolist |
| 用户 | todolist |
| 密码 | todolist |

### 2. 后端

```bash
cd server
npm install
npm run dev
```

### 3. 前端（新终端）

```bash
cd client
npm install
npm run dev
```

浏览器打开 **http://localhost:5173**

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/tasks` | 列表 |
| POST | `/api/tasks` | 创建 `{ "title": "..." }` |
| PATCH | `/api/tasks/:id` | 更新完成状态等 |
| DELETE | `/api/tasks/:id` | 删除 |

## 生产部署（Ubuntu + GitHub Actions）

`git push origin main` 自动部署前后端，**完整教程**见 **[deploy/SETUP-GUIDE.md](deploy/SETUP-GUIDE.md)**。

| 步骤 | 操作 |
|------|------|
| 1 | 配置 GitHub Secrets：`SERVER_HOST`、`SERVER_USER`、`SERVER_SSH_KEY`、`FRONTEND_DEPLOY_PATH`、`BACKEND_DEPLOY_PATH` |
| 2 | Ubuntu 安装 Node / Nginx / pm2，克隆项目，配置 Nginx 与 pm2 |
| 3 | `git push origin main` → Actions 自动部署 |

流水线：`.github/workflows/deploy-front.yml`（前端）、`deploy-back.yml`（后端）
