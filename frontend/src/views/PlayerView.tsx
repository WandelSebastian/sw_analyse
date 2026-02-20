import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/client'
import { Modal } from '../components/Modal'
import { ExerciseTimer } from '../components/ExerciseTimer'
import type { Player, WeekPlan, Exercise, ExercisesData, ToastType } from '../types'

const DAYS = ['samstag','sonntag','montag','dienstag','mittwoch','donnerstag','freitag'] as const
const DAY_FULL: Record<string, string> = {
  samstag:'Samstag', sonntag:'Sonntag', montag:'Montag',
  dienstag:'Dienstag', mittwoch:'Mittwoch', donnerstag:'Donnerstag', freitag:'Freitag'
}

const BLOCK_COLORS: Record<string, string> = {
  'wu-spr':'#4CAF50','ukk':'#2196F3','okk':'#FF9800','ukex':'#E91E63','okex':'#9C27B0',
  'ukp':'#00BCD4','okp':'#009688','ukiso':'#795548','okiso':'#607D8B','bh1':'#8BC34A',
  'bh2':'#CDDC39','kv1':'#FFC107','kv2':'#FF5722','praevention':'#3F51B5',
  'spielen':'#555','match':'#c0392b','frei':'#777'
}

const BLOCK_MAP: Record<string, { bodyPart: string; blocks: string[] } | null> = {
  'ukk': {bodyPart:'lowerBody', blocks:['strengthA','strengthB']},
  'okk': {bodyPart:'upperBody', blocks:['strengthA','strengthB']},
  'ukex': {bodyPart:'lowerBody', blocks:['explosiv']},
  'okex': {bodyPart:'upperBody', blocks:['explosiv']},
  'ukiso': {bodyPart:'lowerBody', blocks:['isometrics']},
  'okiso': {bodyPart:'upperBody', blocks:['isometrics']},
  'ukp': {bodyPart:'lowerBody', blocks:['strengthB']},
  'okp': {bodyPart:'upperBody', blocks:['strengthB']},
  'wu-spr': null, 'bh1':null, 'bh2':null, 'kv1':null, 'kv2':null, 'praevention':null
}

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
  const [exercisesData, setExercisesData] = useState<ExercisesData | null>(null)

  // Block detail modal
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTitle, setDetailTitle] = useState('')
  const [detailExercises, setDetailExercises] = useState<Exercise[]>([])
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
    fetch('/data/exercises.json')
      .then(r => r.ok ? r.json() : null)
      .then(setExercisesData)
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

  const openBlockDetail = async (level: string, blockId: string, code: string, duration: number) => {
    const mapping = BLOCK_MAP[blockId]
    if (!mapping) { showToast(code + ': Kein Übungsdetail verfügbar', 'info'); return }

    if (!exercisesData?.levels?.[level]) {
      showToast('Keine Übungen für Level ' + level, 'info')
      return
    }

    const bodyPlan = exercisesData.levels[level][mapping.bodyPart as 'lowerBody' | 'upperBody']
    if (!bodyPlan) { showToast('Keine Übungen für Level ' + level, 'info'); return }

    let exercises: Exercise[] = []
    mapping.blocks.forEach(bk => {
      const exs = (bodyPlan as Record<string, Exercise[]>)[bk]
      if (exs) exercises = exercises.concat(exs)
    })

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
    setDetailExercises(exercises)
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
    showToast('Zeit abgelaufen! Übung beendet.', 'success')
  }, [showToast])

  const handleSaveLog = async () => {
    const entries: Record<string, { weight?: string; note?: string }> = {}
    // Gather from current logData state
    Object.entries(logData).forEach(([exId, data]) => {
      entries[exId] = data
    })
    await api.upsertPlayerLog(logKey.current, { entries, updatedAt: new Date().toISOString() })
    showToast('Einträge gespeichert', 'success')
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
      <h2 style={{ color: 'var(--text-heading)', marginBottom: 16 }}>Spieler-Ansicht</h2>

      <div className="player-select-bar">
        <label className="form-label" style={{ margin: 0 }}>Spieler:</label>
        <select
          className="form-select"
          value={playerId}
          onChange={e => setPlayerId(e.target.value)}
          style={{ maxWidth: 200 }}
        >
          <option value="">-- Spieler wählen --</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>{p.name} (Level {p.level})</option>
          ))}
        </select>
      </div>

      {!playerId ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#128100;</div>
          <div className="empty-state-text">Bitte einen Spieler auswählen</div>
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
              <div className="empty-state-text">Noch kein Wochenplan zugewiesen</div>
            </div>
          ) : (
            <>
              <h3 style={{ color: 'var(--text-heading)', marginBottom: 12 }}>
                Aktueller Wochenplan ({plan.week || 'Unbekannt'})
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
          <p style={{ color: 'var(--text-secondary)' }}>Keine Übungen gefunden</p>
        ) : (
          <>
            {detailExercises.map((ex, i) => (
              <div className="exercise-card" key={ex.id || i}>
                <div className="exercise-name">{ex.order || ''}. {ex.name}</div>
                <div className="exercise-details">
                  <div className="detail-item">
                    <div className="detail-label">RPE</div>
                    <div className="detail-value">{ex.defaultRPE || ex.tempo || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">SxR</div>
                    <div className="detail-value">{ex.defaultSxR || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Gewicht</div>
                    <input
                      className="weight-input"
                      type="text"
                      placeholder={ex.defaultWeight || '-'}
                      value={logData[ex.id]?.weight || ''}
                      onChange={e => updateLogEntry(ex.id, 'weight', e.target.value)}
                    />
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Notiz</div>
                    <input
                      className="weight-input"
                      type="text"
                      style={{ width: 120 }}
                      placeholder="..."
                      value={logData[ex.id]?.note || ''}
                      onChange={e => updateLogEntry(ex.id, 'note', e.target.value)}
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
              Einträge speichern
            </button>
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setDetailOpen(false)}>Schließen</button>
        </div>
      </Modal>
    </div>
  )
}
