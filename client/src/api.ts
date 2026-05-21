export interface Task {
  id: number;
  title: string;
  completed: number | boolean;
  createdAt: string;
  updatedAt: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `请求失败 (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>('/api/health'),
  listTasks: () => request<Task[]>('/api/tasks'),
  createTask: (title: string) =>
    request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify({ title }) }),
  updateTask: (id: number, data: { title?: string; completed?: boolean }) =>
    request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (id: number) =>
    request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
};
