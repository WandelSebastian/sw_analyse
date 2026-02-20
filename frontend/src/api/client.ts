import type { Player, WeekPlan, Media, PlayerLog } from '../types'

const BASE = '/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  // Players
  getPlayers: () => request<Player[]>('/players'),
  createPlayer: (p: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<Player>('/players', { method: 'POST', body: JSON.stringify(p) }),
  updatePlayer: (id: string, p: Partial<Player>) =>
    request<Player>(`/players/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
  deletePlayer: (id: string) => request<void>(`/players/${id}`, { method: 'DELETE' }),

  // WeekPlans
  getWeekPlans: () => request<WeekPlan[]>('/week-plans'),
  getWeekPlan: (id: string) => request<WeekPlan | null>(`/week-plans/${id}`).catch(() => null),
  upsertWeekPlan: (plan: WeekPlan) =>
    request<WeekPlan>(`/week-plans/${plan.id}`, { method: 'PUT', body: JSON.stringify(plan) }),
  deleteWeekPlan: (id: string) => request<void>(`/week-plans/${id}`, { method: 'DELETE' }),

  // Media
  getMedia: () => request<Media[]>('/media'),
  createMedia: (m: Omit<Media, 'id' | 'createdAt'>) =>
    request<Media>('/media', { method: 'POST', body: JSON.stringify(m) }),
  deleteMedia: (id: string) => request<void>(`/media/${id}`, { method: 'DELETE' }),

  // PlayerLogs
  getPlayerLog: (key: string) => request<PlayerLog>(`/player-logs/${key}`).catch(() => null),
  upsertPlayerLog: (key: string, log: Omit<PlayerLog, 'id'>) =>
    request<PlayerLog>(`/player-logs/${key}`, { method: 'PUT', body: JSON.stringify({ id: key, ...log }) }),

  // Settings
  getSetting: (key: string) => request<{ key: string; value: string }>(`/settings/${key}`).catch(() => null),
  upsertSetting: (key: string, value: string) =>
    request<void>(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ key, value }) }),
}
