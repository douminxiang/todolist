/** pm2 生产配置 — 服务器路径 /var/www/todolist */
module.exports = {
  apps: [
    {
      name: 'todolist-api',
      cwd: '/var/www/todolist/server',
      script: 'npm',
      args: 'start',
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
