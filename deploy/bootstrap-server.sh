#!/bin/bash
# TodoList 阿里云 Ubuntu 一次性初始化脚本
# 用法（root 或 sudo）:
#   export GITHUB_REPO=git@github.com:YOUR_USER/todolist.git
#   export MYSQL_PASSWORD='你的强密码'
#   bash deploy/bootstrap-server.sh

set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_ROOT="${APP_ROOT:-/var/www/todolist}"
GITHUB_REPO="${GITHUB_REPO:?请设置 GITHUB_REPO，例如 git@github.com:user/todolist.git}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:?请设置 MYSQL_PASSWORD}"

echo "==> 安装基础依赖"
apt update
apt install -y git curl nginx mysql-server

echo "==> 安装 Node.js 20"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v

echo "==> 安装 pm2"
npm install -g pm2

echo "==> 创建部署用户: $DEPLOY_USER"
id "$DEPLOY_USER" &>/dev/null || useradd -m -s /bin/bash "$DEPLOY_USER"
mkdir -p "$APP_ROOT/html"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_ROOT"

echo "==> 配置 MySQL"
mysql -e "
CREATE DATABASE IF NOT EXISTS todolist CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'todolist'@'localhost' IDENTIFIED BY '${MYSQL_PASSWORD}';
GRANT ALL PRIVILEGES ON todolist.* TO 'todolist'@'localhost';
FLUSH PRIVILEGES;
"

echo "==> 克隆代码（若目录为空）"
if [ ! -d "$APP_ROOT/.git" ]; then
  sudo -u "$DEPLOY_USER" git clone "$GITHUB_REPO" "$APP_ROOT"
else
  echo "仓库已存在，跳过 clone"
fi

echo "==> 写入 server/.env"
sudo -u "$DEPLOY_USER" tee "$APP_ROOT/server/.env" > /dev/null <<EOF
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=todolist
DB_PASSWORD=${MYSQL_PASSWORD}
DB_NAME=todolist
EOF

echo "==> 安装后端依赖并启动 pm2（需完整依赖，含 tsx）"
cd "$APP_ROOT/server"
sudo -u "$DEPLOY_USER" npm ci
cd "$APP_ROOT"
sudo -u "$DEPLOY_USER" bash -lc 'pm2 start ecosystem.config.cjs || pm2 reload ecosystem.config.cjs'
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/$DEPLOY_USER"
sudo -u "$DEPLOY_USER" pm2 save

echo "==> 配置 Nginx"
cp "$APP_ROOT/deploy/nginx/todolist.conf" /etc/nginx/sites-available/todolist
ln -sf /etc/nginx/sites-available/todolist /etc/nginx/sites-enabled/todolist
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> 完成。请配置 GitHub Secrets 后 push main 触发自动部署。"
echo "    验证: curl -s http://127.0.0.1/api/health"
