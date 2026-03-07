import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/client'
import { Modal } from '../components/Modal'
import { ExerciseTimer } from '../components/ExerciseTimer'
import type { Player, WeekPlan, Exercise, LevelExercise, ToastType } from '../types'

const DAYS = ['samstag','sonntag','montag','dienstag','mittwoch','donnerstag','freitag'] as const
const DAY_FULL: Record<string, string> = {
  samstag:'Saturday', sonntag:'Sunday', montag:'Monday',
  dienstag:'Tuesday', mittwoch:'Wednesday', donnerstag:'Thursday', freitag:'Friday'
}

const BLOCK_COLORS: Record<string, string> = {
  'wu-spr':'#4CAF50','ukk':'#2196F3','okk':'#FF9800','ukex':'#E91E63','okex':'#9C27B0',
  'ukp':'#00BCD4','okp':'#009688','ukiso':'#795548','okiso':'#607D8B','ukbh':'#8BC34A',
  'okbh':'#CDDC39','ukkv':'#FFC107','okkv':'#FF5722','praevention':'#3F51B5',
  'spielen':'#555','match':'#c0392b','frei':'#777'
}

// Block IDs now directly match LevelExercise.block values
const EXERCISE_BLOCKS = new Set([
  'ukk','okk','ukex','okex','ukp','okp','ukiso','okiso',
  'ukbh','okbh','ukkv','okkv'
])

function getBlockColor(id: string) { return BLOCK_COLORS[id] || '#888' }

interface TimerState {
  remaining: number
  running: boolean
}

interface Props {
  players: Player[]
  showToast: (msg: string, type: ToastType) => void
}

export function PlayerView({ players, showToast }: Props) {
  const [playerId, setPlayerId] = useState('')
  const [plan, setPlan] = useState<WeekPlan | null>(null)
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [allLevelExercises, setAllLevelExercises] = useState<LevelExercise[]>([])

  // Block detail modal
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTitle, setDetailTitle] = useState('')
  const [detailExercises, setDetailExercises] = useState<(LevelExercise & { exercise?: Exercise })[]>([])
  const [detailBlockId, setDetailBlockId] = useState('')
  const [detailLevel, setDetailLevel] = useState('')
  const [detailDuration, setDetailDuration] = useState(0)
  const [logData, setLogData] = useState<Record<string, { weight?: string; note?: string }>>({})
  const logKey = useRef('')

  // Timer states persisted across modal opens
  const timerStates = useRef<Record<string, TimerState>>({})

  // Force re-render for timer badges
  const [, setTick] = useState(0)
  const forceUpdate = () => setTick(t => t + 1)

  useEffect(() => {
    Promise.all([api.getExercises(), api.getLevelExercises()])
      .then(([exs, les]) => { setAllExercises(exs); setAllLevelExercises(les) })
      .catch(() => null)
  }, [])

  const loadPlan = useCallback(async () => {
    if (!playerId) { setPlan(null); return }
    try {
      const plans = await api.getWeekPlans()
      const playerPlans = plans
        .filter(p => p.playerId === playerId)
        .sort((a, b) => (b.week || '').localeCompare(a.week || ''))
      setPlan(playerPlans[0] || null)
    } catch {
      setPlan(null)
    }
  }, [playerId])

  useEffect(() => { loadPlan() }, [loadPlan])

  const player = players.find(p => p.id === playerId)

  const exerciseMap = new Map(allExercises.map(e => [e.id, e]))

  const openBlockDetail = async (level: string, blockId: string, code: string, duration: number) => {
    if (!EXERCISE_BLOCKS.has(blockId)) { showToast(code + ': No exercise detail available', 'info'); return }

    // Filter level exercises for this level and block
    const matched = allLevelExercises
      .filter(le => le.level === level && le.block === blockId)
      .map(le => ({ ...le, exercise: exerciseMap.get(le.exerciseId) }))
      .sort((a, b) => a.order - b.order)

    if (matched.length === 0) {
      showToast('No exercises for level ' + level, 'info')
      return
    }

    // Load saved log
    const key = playerId + '_' + blockId + '_' + level
    logKey.current = key
    try {
      const saved = await api.getPlayerLog(key)
      setLogData(saved?.entries || {})
    } catch {
      setLogData({})
    }

    setDetailTitle(code + ' - Level ' + level)
    setDetailExercises(matched)
    setDetailBlockId(blockId)
    setDetailLevel(level)
    setDetailDuration(duration)
    setDetailOpen(true)
  }

  const handleTimerStateChange = useCallback((remaining: number, running: boolean) => {
    const key = detailLevel + '_' + detailBlockId
    timerStates.current[key] = { remaining, running }
    forceUpdate()
  }, [detailLevel, detailBlockId])

  const handleTimerFinished = useCallback(() => {
    showToast('Time is up! Exercise finished.', 'success')
  }, [showToast])

  const handleSaveLog = async () => {
    const entries: Record<string, { weight?: string; note?: string }> = {}
    // Gather from current logData state
    Object.entries(logData).forEach(([exId, data]) => {
      entries[exId] = data
    })
    await api.upsertPlayerLog(logKey.current, { entries, updatedAt: new Date().toISOString() })
    showToast('Entries saved', 'success')
  }

  const updateLogEntry = (exId: string, field: 'weight' | 'note', value: string) => {
    setLogData(prev => ({
      ...prev,
      [exId]: { ...prev[exId], [field]: value }
    }))
  }

  const getTimerBadge = (level: string, blockId: string) => {
    const key = level + '_' + blockId
    const s = timerStates.current[key]
    if (!s) return null
    const m = Math.floor(s.remaining / 60)
    const sec = s.remaining % 60
    const formatted = String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0')
    const cls = s.running ? 'running' : 'paused'
    const icon = s.running ? '\u23f1 ' : '\u23f8 '
    return <span className={`timer-badge ${cls}`}>{icon}{formatted}</span>
  }

  const timerKey = detailLevel + '_' + detailBlockId
  const existingTimer = timerStates.current[timerKey]

  return (
    <div className="player-plan-view">
      <h2 style={{ color: 'var(--text-heading)', marginBottom: 16 }}>Player View</h2>

      <div className="player-select-bar">
        <label className="form-label" style={{ margin: 0 }}>Player:</label>
        <select
          className="form-select"
          value={playerId}
          onChange={e => setPlayerId(e.target.value)}
          style={{ maxWidth: 200 }}
        >
          <option value="">-- Select player --</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>{p.name} (Level {p.level})</option>
          ))}
        </select>
      </div>

      {!playerId ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#128100;</div>
          <div className="empty-state-text">Please select a player</div>
        </div>
      ) : !player ? null : (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">{player.name}</span>
              <span className="badge badge-level">Level {player.level}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {player.height ? player.height + ' cm' : ''}
              {player.height && player.weight ? ' | ' : ''}
              {player.weight ? player.weight + ' kg' : ''}
            </div>
          </div>

          {!plan ? (
            <div className="empty-state">
              <div className="empty-state-text">No week plan assigned yet</div>
            </div>
          ) : (
            <>
              <h3 style={{ color: 'var(--text-heading)', marginBottom: 12 }}>
                Current Week Plan ({plan.week || 'Unknown'})
              </h3>
              <div className="week-grid" style={{ marginBottom: 16 }}>
                {DAYS.map(day => {
                  const dayData = plan.days[day]
                  if (!dayData) {
                    return (
                      <div className="day-column" key={day}>
                        <div className="day-header">{DAY_FULL[day]}</div>
                        <div className="day-blocks" />
                      </div>
                    )
                  }
                  return (
                    <div className="day-column" key={day}>
                      <div className="day-header">
                        {DAY_FULL[day]}
                        {dayData.intensity && (
                          <span style={{ fontSize: 11, opacity: 0.7 }}> {dayData.intensity}</span>
                        )}
                      </div>
                      <div className="day-blocks">
                        {(dayData.blocks || []).map((b, i) => (
                          <div
                            key={`${day}-${i}`}
                            className="training-block"
                            style={{ background: getBlockColor(b.id), cursor: 'pointer' }}
                            onClick={() => openBlockDetail(player.level, b.id, b.code, b.duration || 0)}
                          >
                            <span>
                              {b.code}{' '}
                              <span className="block-info">{b.duration ? b.duration + 'm' : ''}</span>
                            </span>
                            <span className="timer-badge-container">
                              {getTimerBadge(player.level, b.id)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Block Detail Modal */}
      <Modal
        open={detailOpen}
        title={detailTitle}
        onClose={() => setDetailOpen(false)}
        maxWidth="800px"
      >
        {detailDuration > 0 && (
          <ExerciseTimer
            level={detailLevel}
            blockId={detailBlockId}
            durationMinutes={detailDuration}
            initialRemaining={existingTimer?.remaining}
            onStateChange={handleTimerStateChange}
            onFinished={handleTimerFinished}
          />
        )}

        {detailExercises.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No exercises found</p>
        ) : (
          <>
            {detailExercises.map((le, i) => (
              <div className="exercise-card" key={le.id || i}>
                <div className="exercise-name">{le.order || ''}. {le.exercise?.name || le.exerciseId}</div>
                <div className="exercise-details">
                  <div className="detail-item">
                    <div className="detail-label">Tempo</div>
                    <div className="detail-value">{le.defaultTempo || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">RPE</div>
                    <div className="detail-value">{le.defaultRPE || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">SxR</div>
                    <div className="detail-value">{le.defaultSxR || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Gewicht</div>
                    <input
                      className="weight-input"
                      type="text"
                      placeholder={le.defaultWeight || '-'}
                      value={logData[le.exerciseId]?.weight || ''}
                      onChange={e => updateLogEntry(le.exerciseId, 'weight', e.target.value)}
                    />
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Notiz</div>
                    <input
                      className="weight-input"
                      type="text"
                      style={{ width: 120 }}
                      placeholder="..."
                      value={logData[le.exerciseId]?.note || ''}
                      onChange={e => updateLogEntry(le.exerciseId, 'note', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 12 }}
              onClick={handleSaveLog}
            >
              Save entries
            </button>
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setDetailOpen(false)}>Close</button>
        </div>
      </Modal>
    </div>
  )
}
