import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/client'
import { Modal } from '../components/Modal'
import type { Player, DayData, WeekPlan, WeekTemplate, TemplatesData, ToastType, Exercise, ExercisesData } from '../types'

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

const DEFAULT_BLOCKS: { id: string; code: string; defaultRPE: number; defaultDuration: number }[] = [
  {id:'wu-spr',code:'WU Spr',defaultRPE:5,defaultDuration:30},
  {id:'ukk',code:'UKK',defaultRPE:6,defaultDuration:20},
  {id:'okk',code:'OKK',defaultRPE:6,defaultDuration:20},
  {id:'ukex',code:'Ukex',defaultRPE:4,defaultDuration:10},
  {id:'okex',code:'Okex',defaultRPE:4,defaultDuration:10},
  {id:'ukp',code:'Ukp',defaultRPE:4,defaultDuration:15},
  {id:'okp',code:'Okp',defaultRPE:4,defaultDuration:15},
  {id:'ukiso',code:'UKiso',defaultRPE:5,defaultDuration:10},
  {id:'okiso',code:'OKiso',defaultRPE:4,defaultDuration:10},
  {id:'bh1',code:'BH1',defaultRPE:3,defaultDuration:10},
  {id:'bh2',code:'BH2',defaultRPE:3,defaultDuration:10},
  {id:'kv1',code:'KV1',defaultRPE:1,defaultDuration:10},
  {id:'kv2',code:'KV2',defaultRPE:2,defaultDuration:10},
  {id:'praevention',code:'Prävention',defaultRPE:2,defaultDuration:10},
]
const EXTRA_BLOCKS = [
  {id:'spielen',code:'Spielen',defaultRPE:0,defaultDuration:0},
  {id:'match',code:'Match',defaultRPE:0,defaultDuration:0},
  {id:'frei',code:'frei',defaultRPE:0,defaultDuration:0},
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

const BLOCK_MAP: Record<string, { bodyPart: string; blocks: string[] } | null> = {
  'ukk': {bodyPart:'lowerBody', blocks:['strengthA','strengthB']},
  'okk': {bodyPart:'upperBody', blocks:['strengthA','strengthB']},
  'ukex': {bodyPart:'lowerBody', blocks:['explosiv']},
  'okex': {bodyPart:'upperBody', blocks:['explosiv']},
  'ukiso': {bodyPart:'lowerBody', blocks:['isometrics']},
  'okiso': {bodyPart:'upperBody', blocks:['isometrics']},
  'ukp': {bodyPart:'lowerBody', blocks:['strengthB']},
  'okp': {bodyPart:'upperBody', blocks:['strengthB']},
}

export function Planner({ players, showToast }: Props) {
  const [playerId, setPlayerId] = useState('')
  const [week, setWeek] = useState(getCurrentWeek)
  const [weekData, setWeekData] = useState<Record<string, DayData>>(getDefaultWeek)
  const [templateIdx, setTemplateIdx] = useState('')
  const [templatesData, setTemplatesData] = useState<TemplatesData | null>(null)
  const [exercisesData, setExercisesData] = useState<ExercisesData | null>(null)
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
  const [blockDetailExercises, setBlockDetailExercises] = useState<Exercise[]>([])

  useEffect(() => {
    const load = async (file: string) => {
      try {
        const r = await fetch(`/data/${file}`)
        if (!r.ok) return null
        return await r.json()
      } catch {
        return null
      }
    }
    Promise.all([load('templates.json'), load('exercises.json')]).then(([tmpl, ex]) => {
      if (!tmpl) {
        tmpl = { buildingBlocks: DEFAULT_BLOCKS.map(b => ({ ...b, color: BLOCK_COLORS[b.id] || '#888', name: b.code })), templates: [] }
      }
      setTemplatesData(tmpl)
      setExercisesData(ex)
    })
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
    if (templateIdx === '') { showToast('Bitte Template wählen', 'error'); return }
    const tmpl = templates[parseInt(templateIdx)]
    if (!tmpl?.weeks?.[0]) return

    if (tmpl.weeks.length > 1) {
      const options = tmpl.weeks.map((w, i) => ({
        label: `Woche ${i + 1}` + (w.totalRPE ? ` (RPE: ${w.totalRPE})` : ''),
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
          const typeLabel: Record<string, string> = { spielen: 'Spielen', match: 'Match', frei: 'frei' }
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
    showToast(`Template "${tmpl.name}" (Woche ${weekIdx + 1}) geladen`, 'success')
  }

  const handleClearWeek = () => {
    const hasBlocks = DAYS.some(d => weekData[d].blocks.length > 0)
    if (hasBlocks) {
      setConfirmClearOpen(true)
    } else {
      setWeekData(getDefaultWeek())
      showToast('Wochenplan geleert', 'info')
    }
  }

  const doClearWeek = () => {
    setConfirmClearOpen(false)
    setWeekData(getDefaultWeek())
    showToast('Wochenplan geleert', 'info')
  }

  const handleSave = async () => {
    if (!playerId) { showToast('Bitte Spieler auswählen', 'error'); return }
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
    showToast('Wochenplan gespeichert', 'success')
  }

  const handleBlockDblClick = (day: string, index: number) => {
    const block = weekData[day].blocks[index]
    if (!block || ['spielen', 'match', 'frei'].includes(block.id)) return

    const mapping = BLOCK_MAP[block.id]
    if (!mapping) { showToast('Keine Übungen für diesen Baustein', 'info'); return }

    let level = '1'
    if (playerId) {
      const player = players.find(p => p.id === playerId)
      if (player) level = player.level
    }

    if (!exercisesData?.levels?.[level]) {
      showToast('Keine Übungen für Level ' + level, 'info')
      return
    }

    const plan = exercisesData.levels[level][mapping.bodyPart as 'lowerBody' | 'upperBody']
    if (!plan) { showToast('Keine Übungen für Level ' + level, 'info'); return }

    let exercises: Exercise[] = []
    mapping.blocks.forEach(bk => {
      const exs = (plan as Record<string, Exercise[]>)[bk]
      if (exs) exercises = exercises.concat(exs)
    })

    setBlockDetailTitle(block.code + ' - Level ' + level)
    setBlockDetailExercises(exercises)
    setBlockDetailOpen(true)
  }

  // Week total
  let weekTotalRPE = 0
  DAYS.forEach(d => { weekTotalRPE += calcDayRPE(weekData[d]) })

  return (
    <div>
      <h2 style={{ color: 'var(--text-heading)', marginBottom: 16 }}>Wochenplanung</h2>

      <div className="week-controls">
        <div className="player-select-bar" style={{ flex: 1 }}>
          <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Spieler:</label>
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
          <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap', marginLeft: 12 }}>Woche:</label>
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
          <button className="btn btn-primary btn-sm" onClick={handleSave}>Speichern</button>
        </div>
      </div>

      {/* Block palette */}
      <div className="card" style={{ padding: 8 }}>
        <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          Bausteine per Drag &amp; Drop oder Klick in den Wochenplan ziehen:
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
                  title="Intensität (z.B. 4+, 3-, 2+)"
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
          <span className="card-title">Wochen-Zusammenfassung</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>RPE: {weekTotalRPE}</span>
        </div>
      </div>

      {/* Day Picker Modal */}
      <Modal
        open={dayPickerOpen}
        title={pendingBlockRef.current ? pendingBlockRef.current.code + ' hinzufügen' : 'Tag auswählen'}
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
          <button className="btn btn-secondary" onClick={() => setDayPickerOpen(false)}>Abbrechen</button>
        </div>
      </Modal>

      {/* Confirm Clear Modal */}
      <Modal
        open={confirmClearOpen}
        title="Wochenplan leeren"
        onClose={() => setConfirmClearOpen(false)}
        maxWidth="420px"
      >
        <div className="dialog-message">
          Alle Bausteine aus dem aktuellen Wochenplan entfernen?
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setConfirmClearOpen(false)}>Abbrechen</button>
          <button className="btn btn-danger" onClick={doClearWeek}>Ja, bestätigen</button>
        </div>
      </Modal>

      {/* Week Picker Modal (for multi-week templates) */}
      <Modal
        open={weekPickerOpen}
        title={pendingTemplateRef.current ? 'Woche auswählen - ' + pendingTemplateRef.current.name : 'Woche auswählen'}
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
          <button className="btn btn-secondary" onClick={() => setWeekPickerOpen(false)}>Abbrechen</button>
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
          <p style={{ color: 'var(--text-secondary)' }}>Keine Übungen gefunden</p>
        ) : (
          blockDetailExercises.map((ex, i) => (
            <div className="exercise-card" key={ex.id || i}>
              <div className="exercise-name">{ex.order || ''}. {ex.name}</div>
              <div className="exercise-details">
                <div className="detail-item"><div className="detail-label">Tempo</div><div className="detail-value">{ex.tempo || ex.defaultRPE || '-'}</div></div>
                <div className="detail-item"><div className="detail-label">RPE</div><div className="detail-value">{ex.defaultRPE || '-'}</div></div>
                <div className="detail-item"><div className="detail-label">SxR</div><div className="detail-value">{ex.defaultSxR || '-'}</div></div>
                <div className="detail-item"><div className="detail-label">Gewicht</div><div className="detail-value">{ex.defaultWeight || '-'}</div></div>
              </div>
            </div>
          ))
        )}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setBlockDetailOpen(false)}>Schließen</button>
        </div>
      </Modal>
    </div>
  )
}
