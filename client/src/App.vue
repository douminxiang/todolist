<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api, type Task } from './api';

const tasks = ref<Task[]>([]);
const newTitle = ref('');
const filter = ref<'all' | 'active' | 'done'>('all');
const loading = ref(false);
const error = ref('');
const dbOk = ref(true);

const filteredTasks = computed(() => {
  if (filter.value === 'active') return tasks.value.filter((t) => !isDone(t));
  if (filter.value === 'done') return tasks.value.filter((t) => isDone(t));
  return tasks.value;
});

const activeCount = computed(() => tasks.value.filter((t) => !isDone(t)).length);

function isDone(task: Task) {
  return Boolean(task.completed);
}

async function loadTasks() {
  loading.value = true;
  error.value = '';
  try {
    const health = await api.health();
    dbOk.value = health.ok;
    tasks.value = await api.listTasks();
  } catch (e) {
    dbOk.value = false;
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function addTask() {
  const title = newTitle.value.trim();
  if (!title) return;
  error.value = '';
  try {
    const task = await api.createTask(title);
    tasks.value.unshift(task);
    newTitle.value = '';
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败';
  }
}

async function toggleTask(task: Task) {
  try {
    const updated = await api.updateTask(task.id, { completed: !isDone(task) });
    const i = tasks.value.findIndex((t) => t.id === task.id);
    if (i >= 0) tasks.value[i] = updated;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '更新失败';
  }
}

async function removeTask(task: Task) {
  if (!confirm(`确定删除「${task.title}」？`)) return;
  try {
    await api.deleteTask(task.id);
    tasks.value = tasks.value.filter((t) => t.id !== task.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败';
  }
}

onMounted(loadTasks);
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>TodoList</h1>
      <span class="badge" :class="{ offline: !dbOk }">
        {{ dbOk ? 'MySQL 已连接' : '数据库未连接' }}
      </span>
    </header>

    <form class="add-form" @submit.prevent="addTask">
      <input v-model="newTitle" type="text" placeholder="输入任务，回车添加" maxlength="500" />
      <button type="submit">添加</button>
    </form>

    <div class="tabs">
      <button
        v-for="tab in [
          { key: 'all', label: '全部' },
          { key: 'active', label: '进行中' },
          { key: 'done', label: '已完成' },
        ]"
        :key="tab.key"
        :class="{ active: filter === tab.key }"
        type="button"
        @click="filter = tab.key as typeof filter"
      >
        {{ tab.label }}
      </button>
      <span class="count">未完成 {{ activeCount }} 项</span>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading" class="hint">加载中…</p>

    <ul v-else-if="filteredTasks.length" class="task-list">
      <li v-for="task in filteredTasks" :key="task.id" class="task-item">
        <label>
          <input type="checkbox" :checked="isDone(task)" @change="toggleTask(task)" />
          <span :class="{ done: isDone(task) }">{{ task.title }}</span>
        </label>
        <button type="button" class="del" @click="removeTask(task)">删除</button>
      </li>
    </ul>
    <p v-else class="hint">暂无任务</p>

    <footer class="footer">Vue 3 + Express + MySQL</footer>
  </div>
</template>

<style scoped>
.app {
  width: 100%;
  max-width: 560px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  padding: 24px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.header h1 { margin: 0; font-size: 1.5rem; }
.badge {
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 999px;
  background: #d1fae5;
  color: #065f46;
}
.badge.offline { background: #fee2e2; color: #991b1b; }
.add-form { display: flex; gap: 8px; margin-bottom: 16px; }
.add-form input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}
.add-form button, .tabs button, .del {
  cursor: pointer;
  border: none;
  border-radius: 8px;
}
.add-form button {
  padding: 10px 16px;
  background: #3b82f6;
  color: #fff;
}
.tabs { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.tabs button { padding: 6px 12px; background: #f3f4f6; color: #374151; }
.tabs button.active { background: #3b82f6; color: #fff; }
.count { margin-left: auto; font-size: 0.85rem; color: #6b7280; }
.error { color: #dc2626; }
.hint { color: #9ca3af; text-align: center; padding: 24px 0; }
.task-list { list-style: none; margin: 0; padding: 0; }
.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f3f4f6;
}
.task-item label { display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer; }
.task-item span.done { text-decoration: line-through; color: #9ca3af; }
.del { padding: 4px 10px; background: #fef2f2; color: #b91c1c; }
.footer { margin-top: 24px; text-align: center; font-size: 0.75rem; color: #9ca3af; }
</style>
