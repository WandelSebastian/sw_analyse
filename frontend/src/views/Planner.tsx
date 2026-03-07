import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/client'
import { Modal } from '../components/Modal'
import type { Player, DayData, WeekPlan, WeekTemplate, TemplatesData, ToastType, Exercise, LevelExercise } from '../types'

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

const DEFAULT_BLOCKS: { id: string; code: string; defaultRPE: number; defaultDuration: number }[] = [
  {id:'wu-spr',code:'WU',defaultRPE:5,defaultDuration:30},
  {id:'ukk',code:'LB-S',defaultRPE:6,defaultDuration:20},
  {id:'okk',code:'UB-S',defaultRPE:6,defaultDuration:20},
  {id:'ukex',code:'LB-Ex',defaultRPE:4,defaultDuration:10},
  {id:'okex',code:'UB-Ex',defaultRPE:4,defaultDuration:10},
  {id:'ukp',code:'LB-P',defaultRPE:4,defaultDuration:15},
  {id:'okp',code:'UB-P',defaultRPE:4,defaultDuration:15},
  {id:'ukiso',code:'LB-Iso',defaultRPE:5,defaultDuration:10},
  {id:'okiso',code:'UB-Iso',defaultRPE:4,defaultDuration:10},
  {id:'ukbh',code:'LB-MH',defaultRPE:3,defaultDuration:10},
  {id:'okbh',code:'UB-MH',defaultRPE:3,defaultDuration:10},
  {id:'ukkv',code:'LB-BP',defaultRPE:1,defaultDuration:10},
  {id:'okkv',code:'UB-BP',defaultRPE:2,defaultDuration:10},
  {id:'praevention',code:'Prev',defaultRPE:2,defaultDuration:10},
]
const EXTRA_BLOCKS = [
  {id:'spielen',code:'Play',defaultRPE:0,defaultDuration:0},
  {id:'match',code:'Match',defaultRPE:0,defaultDuration:0},
  {id:'frei',code:'Off',defaultRPE:0,defaultDuration:0},
]

function getBlockColor(id: string) { return BLOCK_COLORS[id] || '#888' }

function getDefaultWeek(): Record<string, DayData> {
  const w: Record<string, DayData> = {}
  DAYS.forEach(d => { w[d] = { blocks: [], intensity: '', type: 'training' } })
  return w
}

function getCurrentWeek(): string {
  const now = new Date()
  const yr = now.getFullYear()
  const oneJan = new Date(yr, 0, 1)
  const wk = Math.ceil(((now.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)
  return `${yr}-W${String(wk).padStart(2, '0')}`
}

function calcDayRPE(day: DayData) {
  return day.blocks.reduce((sum, b) => sum + ((b.rpe || 0) * (b.duration || 0)), 0)
}

function calcDayDuration(day: DayData) {
  return day.blocks.reduce((sum, b) => sum + (b.duration || 0), 0)
}

interface Props {
  players: Player[]
  showToast: (msg: string, type: ToastType) => void
}

// Block IDs now directly match LevelExercise.block values
const EXERCISE_BLOCKS = new Set([
  'ukk','okk','ukex','okex','ukp','okp','ukiso','okiso',
  'ukbh','okbh','ukkv','okkv'
])

export function Planner({ players, showToast }: Props) {
  const [playerId, setPlayerId] = useState('')
  const [week, setWeek] = useState(getCurrentWeek)
  const [weekData, setWeekData] = useState<Record<string, DayData>>(getDefaultWeek)
  const [templateIdx, setTemplateIdx] = useState('')
  const [templatesData, setTemplatesData] = useState<TemplatesData | null>(null)
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [allLevelExercises, setAllLevelExercises] = useState<LevelExercise[]>([])
  const [dayPickerOpen, setDayPickerOpen] = useState(false)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [weekPickerOpen, setWeekPickerOpen] = useState(false)
  const [weekPickerOptions, setWeekPickerOptions] = useState<{ label: string; value: number }[]>([])
  const pendingBlockRef = useRef<{ id: string; code: string } | null>(null)
  const pendingTemplateRef = useRef<WeekTemplate | null>(null)
  const draggedRef = useRef<{ fromPalette: boolean; id?: string; code?: string; fromDay?: string; index?: number } | null>(null)

  // Block exercises detail modal
  const [blockDetailOpen, setBlockDetailOpen] = useState(false)
  const [blockDetailTitle, setBlockDetailTitle] = useState('')
  const [blockDetailExercises, setBlockDetailExercises] = useState<(LevelExercise & { exercise?: Exercise })[]>([])

  useEffect(() => {
    const loadStatic = async (file: string) => {
      try { const r = await fetch(`/data/${file}`); return r.ok ? await r.json() : null }
      catch { return null }
    }
    loadStatic('templates.json').then(tmpl => {
      if (!tmpl) {
        tmpl = { buildingBlocks: DEFAULT_BLOCKS.map(b => ({ ...b, color: BLOCK_COLORS[b.id] || '#888', name: b.code })), templates: [] }
      }
      setTemplatesData(tmpl)
    })
    Promise.all([api.getExercises(), api.getLevelExercises()])
      .then(([exs, les]) => { setAllExercises(exs); setAllLevelExercises(les) })
      .catch(() => null)
  }, [])

  const loadSavedPlan = useCallback(async () => {
    if (!playerId || !week) return
    try {
      const plan = await api.getWeekPlan(playerId + '_' + week)
      if (plan?.days) {
        setWeekData(plan.days)
      }
    } catch { /* no saved plan */ }
  }, [playerId, week])

  useEffect(() => { loadSavedPlan() }, [loadSavedPlan])

  const buildingBlocks = templatesData?.buildingBlocks || DEFAULT_BLOCKS.map(b => ({ ...b, color: BLOCK_COLORS[b.id], name: b.code }))
  const templates = templatesData?.templates || []

  const allPaletteBlocks = [
    ...buildingBlocks.map(b => ({ id: b.id, code: b.code })),
    ...EXTRA_BLOCKS.map(b => ({ id: b.id, code: b.code }))
  ]

  const getBlockDefaults = (blockId: string) => {
    const def = buildingBlocks.find(b => b.id === blockId)
    if (def) {
      const dur = typeof def.defaultDuration === 'object'
        ? ((def.defaultDuration as Record<string, number>)['1-6'] || 20)
        : (def.defaultDuration || 10)
      return { rpe: def.defaultRPE || 3, duration: dur }
    }
    const fallback = [...DEFAULT_BLOCKS, ...EXTRA_BLOCKS].find(b => b.id === blockId)
    return { rpe: fallback?.defaultRPE || 0, duration: fallback?.defaultDuration || 0 }
  }

  const addBlockToDay = (day: string, blockId: string, code: string) => {
    const { rpe, duration } = getBlockDefaults(blockId)
    setWeekData(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        blocks: [...prev[day].blocks, { id: blockId, code, rpe, duration }]
      }
    }))
  }

  const removeBlock = (day: string, index: number) => {
    setWeekData(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        blocks: prev[day].blocks.filter((_, i) => i !== index)
      }
    }))
  }

  const moveBlock = (fromDay: string, fromIndex: number, toDay: string) => {
    setWeekData(prev => {
      const block = prev[fromDay].blocks[fromIndex]
      if (!block) return prev
      return {
        ...prev,
        [fromDay]: { ...prev[fromDay], blocks: prev[fromDay].blocks.filter((_, i) => i !== fromIndex) },
        [toDay]: { ...prev[toDay], blocks: [...prev[toDay].blocks, block] }
      }
    })
  }

  const setIntensity = (day: string, value: string) => {
    setWeekData(prev => ({
      ...prev,
      [day]: { ...prev[day], intensity: value }
    }))
  }

  const handlePaletteClick = (blockId: string, code: string) => {
    pendingBlockRef.current = { id: blockId, code }
    setDayPickerOpen(true)
  }

  const handleDayPick = (day: string) => {
    setDayPickerOpen(false)
    if (pendingBlockRef.current) {
      addBlockToDay(day, pendingBlockRef.current.id, pendingBlockRef.current.code)
      pendingBlockRef.current = null
    }
  }

  const handleDragStart = (e: React.DragEvent, source: { fromPalette: boolean; id?: string; code?: string; fromDay?: string; index?: number }) => {
    draggedRef.current = source
    e.dataTransfer.effectAllowed = source.fromPalette ? 'copy' : 'move'
    if (!source.fromPalette && e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '1'
  }

  const handleDrop = (e: React.DragEvent, day: string) => {
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.classList.remove('drag-over')
    const d = draggedRef.current
    if (!d) return
    if (d.fromPalette && d.id && d.code) {
      addBlockToDay(day, d.id, d.code)
    } else if (!d.fromPalette && d.fromDay !== undefined && d.index !== undefined) {
      moveBlock(d.fromDay, d.index, day)
    }
    draggedRef.current = null
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = draggedRef.current?.fromPalette ? 'copy' : 'move';
    (e.currentTarget as HTMLElement).classList.add('drag-over')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      (e.currentTarget as HTMLElement).classList.remove('drag-over')
    }
  }

  const handleLoadTemplate = () => {
    if (templateIdx === '') { showToast('Please select a template', 'error'); return }
    const tmpl = templates[parseInt(templateIdx)]
    if (!tmpl?.weeks?.[0]) return

    if (tmpl.weeks.length > 1) {
      const options = tmpl.weeks.map((w, i) => ({
        label: `Week ${i + 1}` + (w.totalRPE ? ` (RPE: ${w.totalRPE})` : ''),
        value: i
      }))
      setWeekPickerOptions(options)
      pendingTemplateRef.current = tmpl
      setWeekPickerOpen(true)
    } else {
      applyTemplate(tmpl, 0)
    }
  }

  const handleWeekPick = (weekIdx: number) => {
    setWeekPickerOpen(false)
    const tmpl = pendingTemplateRef.current
    if (tmpl) {
      applyTemplate(tmpl, weekIdx)
      pendingTemplateRef.current = null
    }
  }

  const applyTemplate = (tmpl: WeekTemplate, weekIdx: number) => {
    const weekDef = tmpl.weeks[weekIdx]
    const newData: Record<string, DayData> = {}

    DAYS.forEach(day => {
      const dayDef = weekDef.days[day]
      if (dayDef) {
        const specialTypes = ['spielen', 'match', 'frei']
        if (dayDef.type && specialTypes.includes(dayDef.type)) {
          const typeLabel: Record<string, string> = { spielen: 'Play', match: 'Match', frei: 'Off' }
          newData[day] = {
            blocks: [{ id: dayDef.type, code: typeLabel[dayDef.type] || dayDef.type, rpe: 0, duration: 0 }],
            intensity: dayDef.intensity || '',
            type: dayDef.type
          }
        } else {
          newData[day] = {
            blocks: (dayDef.blocks || []).map(b => {
              const def = buildingBlocks.find(bb => bb.id === b.blockId)
              return { id: b.blockId, code: def ? def.code : b.blockId, rpe: b.rpe, duration: b.duration }
            }),
            intensity: dayDef.intensity || '',
            type: dayDef.type || 'training'
          }
        }
      } else {
        newData[day] = { blocks: [], intensity: '', type: 'training' }
      }
    })

    setWeekData(newData)
    showToast(`Template "${tmpl.name}" (Week ${weekIdx + 1}) loaded`, 'success')
  }

  const handleClearWeek = () => {
    const hasBlocks = DAYS.some(d => weekData[d].blocks.length > 0)
    if (hasBlocks) {
      setConfirmClearOpen(true)
    } else {
      setWeekData(getDefaultWeek())
      showToast('Week plan cleared', 'info')
    }
  }

  const doClearWeek = () => {
    setConfirmClearOpen(false)
    setWeekData(getDefaultWeek())
    showToast('Week plan cleared', 'info')
  }

  const handleSave = async () => {
    if (!playerId) { showToast('Please select a player', 'error'); return }
    let totalRPE = 0
    DAYS.forEach(d => { totalRPE += calcDayRPE(weekData[d]) })

    const plan: WeekPlan = {
      id: playerId + '_' + week,
      playerId,
      week,
      days: JSON.parse(JSON.stringify(weekData)),
      totalRPE,
      createdAt: new Date().toISOString()
    }
    await api.upsertWeekPlan(plan)
    showToast('Week plan saved', 'success')
  }

  const handleBlockDblClick = (day: string, index: number) => {
    const block = weekData[day].blocks[index]
    if (!block || ['spielen', 'match', 'frei'].includes(block.id)) return

    if (!EXERCISE_BLOCKS.has(block.id)) { showToast('No exercises for this block', 'info'); return }

    let level = '1'
    if (playerId) {
      const player = players.find(p => p.id === playerId)
      if (player) level = player.level
    }

    const exerciseMap = new Map(allExercises.map(e => [e.id, e]))
    const matched = allLevelExercises
      .filter(le => le.level === level && le.block === block.id)
      .map(le => ({ ...le, exercise: exerciseMap.get(le.exerciseId) }))
      .sort((a, b) => a.order - b.order)

    if (matched.length === 0) {
      showToast('No exercises for level ' + level, 'info')
      return
    }

    setBlockDetailTitle(block.code + ' - Level ' + level)
    setBlockDetailExercises(matched)
    setBlockDetailOpen(true)
  }

  // Week total
  let weekTotalRPE = 0
  DAYS.forEach(d => { weekTotalRPE += calcDayRPE(weekData[d]) })

  return (
    <div>
      <h2 style={{ color: 'var(--text-heading)', marginBottom: 16 }}>Week Planner</h2>

      <div className="week-controls">
        <div className="player-select-bar" style={{ flex: 1 }}>
          <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Player:</label>
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
          <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap', marginLeft: 12 }}>Week:</label>
          <input
            type="week"
            className="form-input"
            value={week}
            onChange={e => setWeek(e.target.value)}
            style={{ maxWidth: 180 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select
            className="form-select"
            value={templateIdx}
            onChange={e => setTemplateIdx(e.target.value)}
            style={{ maxWidth: 250 }}
          >
            <option value="">-- Template laden --</option>
            {templates.map((t, i) => (
              <option key={i} value={i}>{t.name} ({t.levelRange})</option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={handleLoadTemplate}>Laden</button>
          <button className="btn btn-secondary btn-sm" onClick={handleClearWeek}>Leeren</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
        </div>
      </div>

      {/* Block palette */}
      <div className="card" style={{ padding: 8 }}>
        <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          Drag &amp; drop or click blocks to add to the week plan:
        </div>
        <div className="block-palette">
          {allPaletteBlocks.map(b => (
            <div
              key={b.id}
              className="palette-block"
              draggable
              style={{ background: getBlockColor(b.id) }}
              onClick={() => handlePaletteClick(b.id, b.code)}
              onDragStart={e => handleDragStart(e, { fromPalette: true, id: b.id, code: b.code })}
            >
              {b.code}
            </div>
          ))}
        </div>
      </div>

      {/* Week grid */}
      <div className="week-grid">
        {DAYS.map(day => {
          const data = weekData[day]
          const dayRPE = calcDayRPE(data)
          const dayDuration = calcDayDuration(data)

          return (
            <div className="day-column" key={day}>
              <div className="day-header">
                {DAY_FULL[day]}
                <input
                  type="text"
                  value={data.intensity}
                  onChange={e => setIntensity(day, e.target.value)}
                  style={{
                    width: 35, textAlign: 'center', background: 'var(--bg-input)',
                    border: '1px solid var(--border)', borderRadius: 4,
                    color: 'var(--text-primary)', fontSize: 11, padding: 2, marginLeft: 4
                  }}
                  placeholder="--"
                  title="Intensity (e.g. 4+, 3-, 2+)"
                />
              </div>
              <div
                className="day-blocks"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, day)}
              >
                {data.blocks.map((b, i) => {
                  const isSpecial = ['spielen', 'match', 'frei'].includes(b.id)
                  return (
                    <div
                      key={`${day}-${i}`}
                      className="training-block"
                      draggable={!isSpecial}
                      style={{ background: getBlockColor(b.id) }}
                      onDragStart={e => handleDragStart(e, { fromPalette: false, fromDay: day, index: i })}
                      onDragEnd={handleDragEnd}
                      onDoubleClick={() => handleBlockDblClick(day, i)}
                    >
                      <span>
                        {b.code}{' '}
                        <span className="block-info">
                          {b.rpe ? 'RPE:' + b.rpe : ''} {b.duration ? b.duration + 'm' : ''}
                        </span>
                      </span>
                      <button
                        className="block-remove"
                        onClick={(e) => { e.stopPropagation(); removeBlock(day, i) }}
                      >
                        &#10005;
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="day-footer">
                <span>{dayDuration} min</span>
                <span className="rpe-total">RPE: {dayRPE}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Week total */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">Weekly Summary</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>RPE: {weekTotalRPE}</span>
        </div>
      </div>

      {/* Day Picker Modal */}
      <Modal
        open={dayPickerOpen}
        title={pendingBlockRef.current ? pendingBlockRef.current.code + ' — Select Day' : 'Select Day'}
        onClose={() => setDayPickerOpen(false)}
        maxWidth="380px"
      >
        <div className="day-picker-grid">
          {DAYS.map(d => (
            <button key={d} className="day-picker-btn" onClick={() => handleDayPick(d)}>
              {DAY_FULL[d]}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setDayPickerOpen(false)}>Cancel</button>
        </div>
      </Modal>

      {/* Confirm Clear Modal */}
      <Modal
        open={confirmClearOpen}
        title="Clear Week Plan"
        onClose={() => setConfirmClearOpen(false)}
        maxWidth="420px"
      >
        <div className="dialog-message">
          Remove all blocks from the current week plan?
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setConfirmClearOpen(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={doClearWeek}>Yes, confirm</button>
        </div>
      </Modal>

      {/* Week Picker Modal (for multi-week templates) */}
      <Modal
        open={weekPickerOpen}
        title={pendingTemplateRef.current ? 'Select Week - ' + pendingTemplateRef.current.name : 'Select Week'}
        onClose={() => setWeekPickerOpen(false)}
        maxWidth="420px"
      >
        <div className="dialog-options">
          {weekPickerOptions.map(opt => (
            <button
              key={opt.value}
              className="dialog-option-btn"
              onClick={() => handleWeekPick(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setWeekPickerOpen(false)}>Cancel</button>
        </div>
      </Modal>

      {/* Block Exercises Detail */}
      <Modal
        open={blockDetailOpen}
        title={blockDetailTitle}
        onClose={() => setBlockDetailOpen(false)}
        maxWidth="800px"
      >
        {blockDetailExercises.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No exercises found</p>
        ) : (
          blockDetailExercises.map((le, i) => (
            <div className="exercise-card" key={le.id || i}>
              <div className="exercise-name">{le.order || ''}. {le.exercise?.name || le.exerciseId}</div>
              <div className="exercise-details">
                <div className="detail-item"><div className="detail-label">Tempo</div><div className="detail-value">{le.defaultTempo || '-'}</div></div>
                <div className="detail-item"><div className="detail-label">RPE</div><div className="detail-value">{le.defaultRPE || '-'}</div></div>
                <div className="detail-item"><div className="detail-label">SxR</div><div className="detail-value">{le.defaultSxR || '-'}</div></div>
                <div className="detail-item"><div className="detail-label">Gewicht</div><div className="detail-value">{le.defaultWeight || '-'}</div></div>
              </div>
            </div>
          ))
        )}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setBlockDetailOpen(false)}>Close</button>
        </div>
      </Modal>
    </div>
  )
}
