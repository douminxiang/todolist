# GitHub Actions 前后端自动化部署完整指南（Ubuntu）

> **拿来即用**：配置 GitHub Secrets → 初始化 Ubuntu 服务器 → `git push origin main` 自动部署。  
> 适配 **Vue / React** 前端 + **Node / Express / NestJS** 后端，本仓库开箱即用。

---

## 目录

1. [架构说明](#1-架构说明)
2. [GitHub Secrets 完整清单](#2-github-secrets-完整清单)
3. [Ubuntu 服务器前期准备](#3-ubuntu-服务器前期准备)
4. [SSH 密钥生成与免密登录](#4-ssh-密钥生成与免密登录)
5. [Nginx 前端配置](#5-nginx-前端配置)
6. [PM2 后端配置](#6-pm2-后端配置)
7. [测试部署流程](#7-测试部署流程)
8. [查看部署日志](#8-查看部署日志)
9. [常见报错与解决办法](#9-常见报错与解决办法)
10. [按需修改项](#10-按需修改项)

---

## 1. 架构说明

| 组件 | 说明 |
|------|------|
| 触发 | 本地 `git push` 到 `main` 分支 |
| 连接 | SSH 免密（私钥存 GitHub Secrets） |
| 前端流水线 | [`.github/workflows/deploy-front.yml`](../.github/workflows/deploy-front.yml) |
| 后端流水线 | [`.github/workflows/deploy-back.yml`](../.github/workflows/deploy-back.yml) |
| 前端产物 | `client/dist` → Nginx 静态目录 |
| 后端进程 | 服务器 `git pull` → `npm ci` → `pm2 reload` |

```
push main ─┬─ deploy-front.yml → 构建 dist → 上传至 FRONTEND_DEPLOY_PATH
           └─ deploy-back.yml  → SSH → git pull → pm2 重启
```

---

## 2. GitHub Secrets 完整清单

路径：**GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret**

### 必填（共 5 个）

| Secret 名称 | 填写格式 / 示例 | 说明 |
|-------------|-----------------|------|
| `SERVER_HOST` | `47.96.xxx.xxx` | 服务器**公网 IP**，纯 IP 无协议前缀 |
| `SERVER_USER` | `ubuntu` 或 `deploy` | SSH 登录用户名 |
| `SERVER_SSH_KEY` | 见下方格式 | SSH **私钥全文**（含首尾行） |
| `FRONTEND_DEPLOY_PATH` | `/var/www/todolist/html` | Nginx 网站根目录，与 nginx `root` 一致 |
| `BACKEND_DEPLOY_PATH` | `/var/www/todolist` | 服务器上 **git 仓库根目录**（含 `server/`、`ecosystem.config.cjs`） |

### 可选（1 个）

| Secret 名称 | 填写格式 | 说明 |
|-------------|----------|------|
| `SERVER_PORT` | `22` | SSH 端口，未创建时 workflow 默认 `22` |

### `SERVER_SSH_KEY` 正确格式

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAAB...
（多行 Base64 内容）
-----END OPENSSH PRIVATE KEY-----
```

- 必须包含 `BEGIN` / `END` 两行
- 复制时**不要**多余空格或漏行
- Windows：`Get-Content $env:USERPROFILE\.ssh\aliyun_deploy -Raw`

### 严禁写入仓库的内容

- 服务器 IP、SSH 私钥、数据库密码
- `server/.env` 仅保存在服务器，已加入 `.gitignore`

---

## 3. Ubuntu 服务器前期准备

以下在 **Ubuntu 20.04 / 22.04** 上执行（SSH 登录后）。

### 3.1 放行端口（安全组 + 防火墙）

**云厂商安全组入方向：**

| 端口 | 用途 |
|------|------|
| 22 | SSH（建议限制来源 IP，勿长期对全网开放） |
| 80 | HTTP 网站 |

> **不要**对公网开放 3000；API 仅通过 Nginx 本机反代 `127.0.0.1:3000`。

**本机防火墙（若启用 ufw）：**

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw enable
sudo ufw status
```

### 3.2 更新系统并安装基础软件

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx
```

### 3.3 安装 Node.js 20

**方式 A — NodeSource（推荐，与 Actions 一致）：**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # 应显示 v20.x
npm -v
```

**方式 B — nvm（多版本管理）：**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 20
nvm alias default 20
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"' >> ~/.bashrc
```

### 3.4 安装 PM2

```bash
sudo npm install -g pm2
pm2 -v
```

### 3.5 配置项目目录与权限

```bash
# 创建目录（与 Secrets 中路径一致）
sudo mkdir -p /var/www/todolist/html
sudo chown -R $USER:$USER /var/www/todolist
chmod -R 755 /var/www/todolist
```

### 3.6 克隆项目（首次）

```bash
cd /var/www
git clone git@github.com:YOUR_USER/todolist.git todolist
# 或使用 HTTPS（需配置 token）
# git clone https://github.com/YOUR_USER/todolist.git todolist
```

### 3.7 配置后端环境变量（仅服务器本地）

```bash
cat > /var/www/todolist/server/.env <<'EOF'
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=todolist
DB_PASSWORD=你的强密码
DB_NAME=todolist
EOF
```

### 3.8 MySQL（本仓库需要）

```bash
sudo apt install -y mysql-server
sudo mysql -e "
CREATE DATABASE IF NOT EXISTS todolist CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'todolist'@'localhost' IDENTIFIED BY '你的强密码';
GRANT ALL PRIVILEGES ON todolist.* TO 'todolist'@'localhost';
FLUSH PRIVILEGES;
"
```

### 3.9 安装依赖并首次启动 PM2

```bash
cd /var/www/todolist/server
npm ci
cd /var/www/todolist
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
# 执行上一条输出的 sudo 命令
```

### 3.10 一键脚本（可选）

```bash
export GITHUB_REPO=git@github.com:YOUR_USER/todolist.git
export MYSQL_PASSWORD='你的强密码'
sudo bash deploy/bootstrap-server.sh
```

### 3.11 部署用户 sudo（CI 重载 Nginx 时需要）

```bash
sudo visudo
# 末尾添加（将 ubuntu 换成你的 SERVER_USER）：
ubuntu ALL=(ALL) NOPASSWD:ALL
```

---

## 4. SSH 密钥生成与免密登录

### 4.1 本地生成密钥对

```bash
# Windows PowerShell / macOS / Linux
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/aliyun_deploy -N ""
```

生成文件：

- `~/.ssh/aliyun_deploy` → 私钥 → GitHub Secret **`SERVER_SSH_KEY`**
- `~/.ssh/aliyun_deploy.pub` → 公钥 → 服务器 `authorized_keys`

### 4.2 公钥写入服务器

```bash
ssh-copy-id -i ~/.ssh/aliyun_deploy.pub ubuntu@你的服务器IP
```

或手动：

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "公钥一整行内容" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 755 ~   # 家目录不可被 group/other 写
```

### 4.3 验证免密

```bash
ssh -i ~/.ssh/aliyun_deploy ubuntu@你的服务器IP
```

### 4.4 服务器拉取 GitHub 代码（Deploy Key）

后端流水线在服务器执行 `git pull`，需单独配置：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

将公钥添加到：**GitHub 仓库 → Settings → Deploy keys → Add（只读）**

```bash
ssh-keyscan github.com >> ~/.ssh/known_hosts
chmod 600 ~/.ssh/known_hosts
cd /var/www/todolist
git remote -v
git pull origin main
```

---

## 5. Nginx 前端配置

### 5.1 安装并启用

```bash
sudo apt install nginx -y
sudo systemctl enable nginx
```

### 5.2 部署站点文件

仓库模板：[`deploy/nginx/todolist.conf`](nginx/todolist.conf)

```bash
sudo cp /var/www/todolist/deploy/nginx/todolist.conf /etc/nginx/sites-available/todolist
sudo ln -sf /etc/nginx/sites-available/todolist /etc/nginx/sites-enabled/todolist
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

确认 `root` 与 Secret **`FRONTEND_DEPLOY_PATH`** 一致（默认 `/var/www/todolist/html`）。

### 5.3 完整配置说明

- `location /`：`try_files` 支持 Vue/React History 路由
- `location /api/`：反代到 `http://127.0.0.1:3000`
- 静态资源 30 天缓存
- 日志：`/var/log/nginx/todolist_*.log`

---

## 6. PM2 后端配置

文件：[`ecosystem.config.cjs`](../ecosystem.config.cjs)

```javascript
module.exports = {
  apps: [{
    name: 'todolist-api',              // 与 deploy-back.yml 中名称一致
    cwd: '/var/www/todolist/server',   // 与 BACKEND_DEPLOY_PATH 对应
    script: 'npm',
    args: 'start',
    instances: 1,
    autorestart: true,
    max_memory_restart: '300M',
    env: { NODE_ENV: 'production' },
  }],
};
```

| 命令 | 说明 |
|------|------|
| `pm2 status` | 查看进程 |
| `pm2 logs todolist-api` | 实时日志 |
| `pm2 reload todolist-api` | 零停机重载 |
| `pm2 save` | 保存列表（开机恢复） |

**NestJS**：将 `args: 'start'` 改为 `run start:prod`，或 `script: 'dist/main.js'` 并取消 workflow 中 `npm run build` 注释。

---

## 7. 测试部署流程

### 7.1 配置 Secrets

按 [第 2 节](#2-github-secrets-完整清单) 创建全部 Secrets。

### 7.2 手动验证（推荐首次）

```bash
# 本地前端
cd client && npm ci && npm run build
scp -i ~/.ssh/aliyun_deploy -r dist/* ubuntu@IP:/var/www/todolist/html/

# 服务器后端
ssh -i ~/.ssh/aliyun_deploy ubuntu@IP
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1/api/health
```

### 7.3 自动部署

```bash
git add .
git commit -m "chore: 配置 CI/CD"
git push origin main
```

- 仅改 `client/**` → 只跑 **部署前端**
- 仅改 `server/**` → 只跑 **部署后端**
- 也可在 Actions 页 **Run workflow** 手动触发

### 7.4 验收

浏览器打开 `http://公网IP/`，能加载页面并创建待办；开发者工具中 `/api/tasks` 返回 200。

---

## 8. 查看部署日志

### GitHub Actions

1. 打开仓库 → **Actions**
2. 点击 **部署前端** 或 **部署后端**
3. 进入最近一次 run → 展开各 step 查看输出

### 服务器

```bash
pm2 logs todolist-api
sudo tail -f /var/log/nginx/todolist_error.log
sudo tail -f /var/log/nginx/todolist_access.log
```

---

## 9. 常见报错与解决办法

| 报错 / 现象 | 原因 | 解决办法 |
|-------------|------|----------|
| `Permission denied (publickey)` | 私钥或公钥配置错误 | 核对 `SERVER_SSH_KEY` 完整；`chmod 600 authorized_keys` |
| `npm ci` 失败 | 无 lock 文件 | 本地 `npm install` 后提交 `package-lock.json` |
| 前端部署成功但页面 404 | Nginx root 与 `FRONTEND_DEPLOY_PATH` 不一致 | 统一为 `/var/www/todolist/html` |
| 页面无样式 / 空白 | dist 未含 assets | 已用 tar 打包上传；检查 `ls html/assets` |
| API 502 / 503 | pm2 未运行或 MySQL 失败 | `pm2 logs`；`systemctl status mysql`；检查 `server/.env` |
| `git pull` 失败 | 服务器无 GitHub 权限 | 配置 Deploy Key 或 HTTPS token |
| `Host key verification failed` | 未信任 github.com | `ssh-keyscan github.com >> ~/.ssh/known_hosts` |
| `sudo: no tty present` | sudo 需密码 | `visudo` 配置 `NOPASSWD:ALL` |
| `tsx: command not found` | 用了 `npm ci --production` | 必须用完整 `npm ci`（workflow 已修正） |
| 安全组已放行仍无法访问 | 实例防火墙 / IP 错误 | 检查 ufw 与公网 IP |
| pm2 重启后消失 | 未开机自启 | `pm2 save` + `pm2 startup` |

---

## 10. 按需修改项

| 场景 | 修改位置 |
|------|----------|
| Create React App（输出 `build`） | `deploy-front.yml` → `BUILD_DIR: build` |
| 前端在仓库根目录 | `WORK_DIR: .` |
| NestJS 需编译 | `deploy-back.yml` 取消 `npm run build` 注释 |
| 后端目录名不是 `server` | `deploy-back.yml` → `SERVER_DIR` |
| 仅 IP 访问 | `todolist.conf` → `server_name _;`（已默认） |
| 更换服务器路径 | 改 Secrets + `ecosystem.config.cjs` 的 `cwd` + nginx `root` |

---

## 相关文件

| 文件 | 作用 |
|------|------|
| `.github/workflows/deploy-front.yml` | 前端流水线 |
| `.github/workflows/deploy-back.yml` | 后端流水线 |
| `ecosystem.config.cjs` | PM2 配置 |
| `deploy/nginx/todolist.conf` | Nginx 模板 |
| `deploy/bootstrap-server.sh` | 服务器一键初始化 |
