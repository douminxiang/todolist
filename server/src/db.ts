import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'todolist',
  password: process.env.DB_PASSWORD ?? 'todolist',
  database: process.env.DB_NAME ?? 'todolist',
  waitForConnections: true,
  connectionLimit: 10,
});

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM tasks');
  const count = Number((rows as { count: number }[])[0]?.count ?? 0);
  if (count === 0) {
    await pool.query(
      'INSERT INTO tasks (title, completed) VALUES (?, ?), (?, ?)',
      ['欢迎使用 TodoList', 0, '勾选左侧可标记完成', 0]
    );
  }
}
