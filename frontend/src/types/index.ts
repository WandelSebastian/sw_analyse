export interface Player {
  id: string
  name: string
  height?: string
  weight?: string
  level: string
  dob?: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface DayBlock {
  id: string
  code: string
  rpe: number
  duration: number
}

export interface DayData {
  blocks: DayBlock[]
  intensity: string
  type: string
}

export interface WeekPlan {
  id: string
  playerId: string
  week: string
  days: Record<string, DayData>
  totalRPE: number
  createdAt: string
}

export interface Media {
  id: string
  exerciseId: string
  type: 'image' | 'video'
  data: string
  name: string
  createdAt: string
}

export interface PlayerLog {
  id: string
  entries: Record<string, { weight?: string; note?: string }>
  updatedAt: string
}

export interface Exercise {
  id: string
  name: string
  order?: number
  tempo?: string
  defaultRPE?: string | number
  defaultSxR?: string
  defaultWeight?: string
  level?: string
  bodyPart?: string
  block?: string
}

export interface ProgressionLevel {
  level: string
  exercise: string
}

export interface Progression {
  id?: string
  name?: string
  fullName?: string
  levels: ProgressionLevel[]
  source?: string
}

export interface BuildingBlock {
  id: string
  code: string
  name: string
  defaultRPE: number
  defaultDuration: number | Record<string, number>
  color: string
}

export interface ExercisesData {
  levels: Record<string, {
    lowerBody?: Record<string, Exercise[]>
    upperBody?: Record<string, Exercise[]>
  }>
}

export interface ProgressionsData {
  lowerBody: Progression[]
  upperBody: Progression[]
}

export interface TemplatesData {
  buildingBlocks: BuildingBlock[]
  templates: WeekTemplate[]
}

export interface WeekTemplate {
  name: string
  levelRange: string
  weeks: {
    totalRPE?: number
    days: Record<string, {
      type?: string
      intensity?: string
      blocks?: { blockId: string; rpe: number; duration: number }[]
    }>
  }[]
}

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
}

export type ViewId = 'dashboard' | 'planner' | 'players' | 'exercises' | 'player-view'
