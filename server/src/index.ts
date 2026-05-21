import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import type { ResultSetHeader } from 'mysql2';
import { initDb, pool } from './db.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, message: '数据库未连接' });
  }
});

app.get('/api/tasks', async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id, title, completed,
            created_at AS createdAt, updated_at AS updatedAt
     FROM tasks ORDER BY created_at DESC`
  );
  res.json(rows);
});

app.post('/api/tasks', async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title) {
    res.status(400).json({ message: '标题不能为空' });
    return;
  }
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO tasks (title, completed) VALUES (?, 0)',
    [title]
  );
  const [rows] = await pool.query(
    `SELECT id, title, completed,
            created_at AS createdAt, updated_at AS updatedAt
     FROM tasks WHERE id = ?`,
    [result.insertId]
  );
  res.status(201).json((rows as object[])[0]);
});

app.patch('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const title = req.body?.title !== undefined ? String(req.body.title).trim() : undefined;
  const completed = req.body?.completed;

  if (title !== undefined && !title) {
    res.status(400).json({ message: '标题不能为空' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (title !== undefined) {
    fields.push('title = ?');
    values.push(title);
  }
  if (completed !== undefined) {
    fields.push('completed = ?');
    values.push(completed ? 1 : 0);
  }
  if (fields.length === 0) {
    res.status(400).json({ message: '没有可更新的字段' });
    return;
  }
  values.push(id);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  if (result.affectedRows === 0) {
    res.status(404).json({ message: '任务不存在' });
    return;
  }
  const [rows] = await pool.query(
    `SELECT id, title, completed,
            created_at AS createdAt, updated_at AS updatedAt
     FROM tasks WHERE id = ?`,
    [id]
  );
  res.json((rows as object[])[0]);
});

app.delete('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM tasks WHERE id = ?',
    [id]
  );
  if (result.affectedRows === 0) {
    res.status(404).json({ message: '任务不存在' });
    return;
  }
  res.status(204).send();
});

async function start() {
  let retries = 10;
  while (retries > 0) {
    try {
      await initDb();
      break;
    } catch (err) {
      retries -= 1;
      if (retries === 0) {
        console.error('无法连接 MySQL：', err);
        process.exit(1);
      }
      console.log('等待 MySQL 就绪…');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  app.listen(PORT, () => {
    console.log(`API: http://localhost:${PORT}`);
  });
}

start();
