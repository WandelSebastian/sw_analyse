import type { Player, WeekPlan, Media, PlayerLog, Exercise, LevelExercise, Progression } from '../types'

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

  // Exercises (master library)
  getExercises: () => request<Exercise[]>('/exercises'),
  getExercise: (id: string) => request<Exercise>(`/exercises/${id}`),
  createExercise: (e: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<Exercise>('/exercises', { method: 'POST', body: JSON.stringify(e) }),
  updateExercise: (id: string, e: Partial<Exercise>) =>
    request<Exercise>(`/exercises/${id}`, { method: 'PUT', body: JSON.stringify(e) }),
  deleteExercise: (id: string) => request<void>(`/exercises/${id}`, { method: 'DELETE' }),

  // Level Exercises (assignments)
  getLevelExercises: (level?: string) =>
    request<LevelExercise[]>(level ? `/level-exercises?level=${level}` : '/level-exercises'),
  createLevelExercise: (le: Omit<LevelExercise, 'id'>) =>
    request<LevelExercise>('/level-exercises', { method: 'POST', body: JSON.stringify(le) }),
  updateLevelExercise: (id: string, le: Partial<LevelExercise>) =>
    request<LevelExercise>(`/level-exercises/${id}`, { method: 'PUT', body: JSON.stringify(le) }),
  deleteLevelExercise: (id: string) => request<void>(`/level-exercises/${id}`, { method: 'DELETE' }),

  // Progressions
  getProgressions: () => request<Progression[]>('/progressions'),
  createProgression: (p: Omit<Progression, 'createdAt' | 'updatedAt'>) =>
    request<Progression>('/progressions', { method: 'POST', body: JSON.stringify(p) }),
  updateProgression: (id: string, p: Partial<Progression>) =>
    request<Progression>(`/progressions/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
  deleteProgression: (id: string) => request<void>(`/progressions/${id}`, { method: 'DELETE' }),
}
