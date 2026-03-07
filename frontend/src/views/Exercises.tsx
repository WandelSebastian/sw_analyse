import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'
import { Modal } from '../components/Modal'
import type { Media, Exercise, LevelExercise, Progression, ProgressionStep, ToastType } from '../types'

interface Props {
  media: Media[]
  onUploadMedia: (m: Omit<Media, 'id' | 'createdAt'>) => Promise<void>
  onDeleteMedia: (id: string) => Promise<void>
  showToast: (msg: string, type: ToastType) => void
}

const BODY_REGIONS = [
  { value: 'lowerBody', label: 'Lower Body' },
  { value: 'upperBody', label: 'Upper Body' },
  { value: 'core', label: 'Core' },
  { value: 'fullBody', label: 'Full Body' },
]

const CATEGORIES = [
  { value: 'BH', label: 'Movement Hygiene' },
  { value: 'KV', label: 'Body Prep' },
  { value: 'K', label: 'Strength' },
  { value: 'P', label: 'Prevention' },
  { value: 'EX', label: 'Explosive' },
  { value: 'ISO', label: 'Isometric' },
]

const LEVELS = ['A','B','C','D','E','F','1','2','3','4','5','6','7','8','9','10']

const BLOCKS = [
  { value: 'ukex', label: 'LB Explosive' },
  { value: 'okex', label: 'UB Explosive' },
  { value: 'ukk', label: 'LB Strength' },
  { value: 'okk', label: 'UB Strength' },
  { value: 'ukp', label: 'LB Prevention' },
  { value: 'okp', label: 'UB Prevention' },
  { value: 'ukiso', label: 'LB Isometric' },
  { value: 'okiso', label: 'UB Isometric' },
  { value: 'ukbh', label: 'LB Movement Hygiene' },
  { value: 'okbh', label: 'UB Movement Hygiene' },
  { value: 'ukkv', label: 'LB Body Prep' },
  { value: 'okkv', label: 'UB Body Prep' },
]

const BODY_PREFIX: Record<string, string> = {
  lowerBody: 'LB', upperBody: 'UB', core: 'Core', fullBody: 'FB'
}
const CAT_SUFFIX: Record<string, string> = {
  K: 'S', P: 'P', EX: 'Ex', ISO: 'Iso', BH: 'MH', KV: 'BP'
}
function getBlockPrefix(bodyRegion: string, category: string): string {
  return (BODY_PREFIX[bodyRegion] || '') + (CAT_SUFFIX[category] || '')
}

// All tag categories – "Equipment" maps to exercise.equipment[], all others to exercise.tags[]
const EQUIPMENT_CATEGORY = 'Equipment'
const DEFAULT_TAG_CATEGORIES: Record<string, string[]> = {
  'Movement Pattern': ['push', 'pull', 'hinge', 'squat', 'lunge', 'rotation'],
  'Contraction': ['concentric', 'eccentric', 'isometric', 'plyometric'],
  'Laterality': ['bilateral', 'unilateral', 'single-leg', 'single-arm'],
  'Load': ['bodyweight', 'weighted'],
  'Position': ['overhead', 'floor', 'standing', 'seated', 'supine', 'prone'],
  'Purpose': ['rehab', 'warmup', 'cooldown', 'mobility', 'stability'],
  [EQUIPMENT_CATEGORY]: ['barbell', 'dumbbell', 'kettlebell', 'band', 'cable machine',
    'medicine ball', 'foam roller', 'box', 'bench', 'pull-up bar',
    'trx', 'stability ball', 'slider', 'mat', 'rope'],
}

const EMPTY_EXERCISE: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', bodyRegion: 'lowerBody', category: 'K',
  tags: [], equipment: [], description: ''
}

export function Exercises({ media, onUploadMedia, onDeleteMedia, showToast }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [levelExercises, setLevelExercises] = useState<LevelExercise[]>([])
  const [progressions, setProgressions] = useState<Progression[]>([])

  const [subTab, setSubTab] = useState<'library' | 'levels' | 'progressions'>('library')
  const [filterBody, setFilterBody] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterBlock, setFilterBlock] = useState('')
  const [search, setSearch] = useState('')
  const [progFilterBody, setProgFilterBody] = useState('')

  // Progression CRUD
  const [progModalOpen, setProgModalOpen] = useState(false)
  const [editingProg, setEditingProg] = useState<Progression | null>(null)
  const [progForm, setProgForm] = useState({ name: '', bodyRegion: 'lowerBody', steps: [] as ProgressionStep[] })
  const [progDelConfirm, setProgDelConfirm] = useState<string | null>(null)

  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [form, setForm] = useState({ ...EMPTY_EXERCISE })
  const [delConfirm, setDelConfirm] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dynamic tag/equipment options (stored in settings)
  const [tagCategories, setTagCategories] = useState<Record<string, string[]>>(DEFAULT_TAG_CATEGORIES)
  const [optionsModalOpen, setOptionsModalOpen] = useState(false)
  const [optionsCatsStr, setOptionsCatsStr] = useState('')

  // Level-Exercise assignment CRUD
  const [leModalOpen, setLeModalOpen] = useState(false)
  const [editingLE, setEditingLE] = useState<LevelExercise | null>(null)
  const [leForm, setLeForm] = useState({
    exerciseId: '', level: 'A', block: 'ukk',
    order: 1, defaultTempo: '', defaultRPE: '', defaultSxR: '', defaultWeight: ''
  })
  const [leDelConfirm, setLeDelConfirm] = useState<string | null>(null)
  const [leSearchTerm, setLeSearchTerm] = useState('')

  const loadData = async () => {
    const [exs, les, progs] = await Promise.all([
      api.getExercises(),
      api.getLevelExercises(),
      api.getProgressions()
    ])
    setExercises(exs)
    setLevelExercises(les)
    setProgressions(progs)
  }

  const loadOptions = async () => {
    const setting = await api.getSetting('tagCategories')
    if (setting?.value) try { setTagCategories(JSON.parse(setting.value)) } catch {}
  }

  useEffect(() => { loadData(); loadOptions() }, [])

  // --- Library tab: master exercises ---
  let filteredExercises = exercises
  if (filterBody) filteredExercises = filteredExercises.filter(e => e.bodyRegion === filterBody)
  if (filterCategory) filteredExercises = filteredExercises.filter(e => e.category === filterCategory)
  if (search) filteredExercises = filteredExercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))

  // --- Levels tab: level assignments joined with exercises ---
  let filteredLE = levelExercises
  if (filterLevel) filteredLE = filteredLE.filter(le => le.level === filterLevel)
  if (filterBlock) filteredLE = filteredLE.filter(le => le.block === filterBlock)

  const exerciseMap = new Map(exercises.map(e => [e.id, e]))

  // Group by level + bodyRegion
  const leGrouped: Record<string, (LevelExercise & { exercise?: Exercise })[]> = {}
  filteredLE.forEach(le => {
    const ex = exerciseMap.get(le.exerciseId)
    const bp = ex?.bodyRegion || 'unknown'
    const bpLabel = BODY_REGIONS.find(b => b.value === bp)?.label || bp
    const key = `Level ${le.level} - ${bpLabel}`
    if (!leGrouped[key]) leGrouped[key] = []
    leGrouped[key].push({ ...le, exercise: ex })
  })

  // --- Progressions ---
  const PROG_REGIONS = [
    { value: 'lowerBody', label: 'Lower Body' },
    { value: 'upperBody', label: 'Upper Body' },
    { value: 'warmup', label: 'Warm-Up' },
  ]
  let filteredProgs = progressions
  if (progFilterBody) filteredProgs = filteredProgs.filter(p => p.bodyRegion === progFilterBody)

  // --- Progression CRUD ---
  function openNewProg() {
    setEditingProg(null)
    setProgForm({ name: '', bodyRegion: 'lowerBody', steps: LEVELS.map(l => ({ level: l, exerciseName: '', exerciseId: '' })) })
    setProgModalOpen(true)
  }

  function openEditProg(prog: Progression) {
    setEditingProg(prog)
    setProgForm({ name: prog.name, bodyRegion: prog.bodyRegion, steps: [...prog.steps] })
    setProgModalOpen(true)
  }

  async function saveProg() {
    if (!progForm.name.trim()) { showToast('Name ist erforderlich', 'error'); return }
    const cleanSteps = progForm.steps.filter(s => s.exerciseName.trim())
    try {
      if (editingProg) {
        await api.updateProgression(editingProg.id, { ...editingProg, name: progForm.name, bodyRegion: progForm.bodyRegion, steps: cleanSteps })
        showToast('Progression aktualisiert', 'success')
      } else {
        const id = progForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        await api.createProgression({ id: progForm.bodyRegion + '-' + id, name: progForm.name, bodyRegion: progForm.bodyRegion, steps: cleanSteps })
        showToast('Progression angelegt', 'success')
      }
      setProgModalOpen(false)
      loadData()
    } catch { showToast('Error saving', 'error') }
  }

  async function deleteProg(id: string) {
    try {
      await api.deleteProgression(id)
      showToast('Progression deleted', 'success')
      setProgDelConfirm(null)
      loadData()
    } catch { showToast('Error deleting', 'error') }
  }

  function updateProgStep(index: number, field: keyof ProgressionStep, value: string) {
    setProgForm(prev => {
      const steps = [...prev.steps]
      steps[index] = { ...steps[index], [field]: value }
      // Try to auto-match exerciseId when name changes
      if (field === 'exerciseName') {
        const match = exercises.find(e => e.name.toUpperCase() === value.toUpperCase())
        steps[index].exerciseId = match?.id || ''
      }
      return { ...prev, steps }
    })
  }

  function addProgStep() {
    setProgForm(prev => ({ ...prev, steps: [...prev.steps, { level: '', exerciseName: '', exerciseId: '' }] }))
  }

  function removeProgStep(index: number) {
    setProgForm(prev => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }))
  }

  // --- Tag/Equipment options management ---
  function openOptionsModal() {
    setOptionsCatsStr(Object.entries(tagCategories).map(([cat, tags]) => `${cat}: ${tags.join(', ')}`).join('\n'))
    setOptionsModalOpen(true)
  }

  async function saveOptions() {
    const newCats: Record<string, string[]> = {}
    for (const line of optionsCatsStr.split('\n')) {
      const idx = line.indexOf(':')
      if (idx < 0) continue
      const cat = line.slice(0, idx).trim()
      const tags = line.slice(idx + 1).split(',').map(t => t.trim()).filter(Boolean)
      if (cat && tags.length) newCats[cat] = tags
    }
    try {
      await api.updateSetting('tagCategories', JSON.stringify(newCats))
      setTagCategories(newCats)
      setOptionsModalOpen(false)
      showToast('Options saved', 'success')
    } catch { showToast('Error saving options', 'error') }
  }

  // --- CRUD handlers ---
  function openNew() {
    setEditingExercise(null)
    setForm({ ...EMPTY_EXERCISE })
    setEditModalOpen(true)
  }

  function openEdit(ex: Exercise) {
    setEditingExercise(ex)
    setForm({
      name: ex.name, bodyRegion: ex.bodyRegion, category: ex.category,
      tags: ex.tags || [], equipment: ex.equipment || [], description: ex.description
    })
    setEditModalOpen(true)
  }

  async function saveExercise() {
    if (!form.name.trim()) { showToast('Name ist erforderlich', 'error'); return }
    const { tags, equipment } = form
    try {
      if (editingExercise) {
        await api.updateExercise(editingExercise.id, {
          ...editingExercise, name: form.name, bodyRegion: form.bodyRegion,
          category: form.category, tags, equipment, description: form.description
        })
        showToast('Exercise updated', 'success')
      } else {
        await api.createExercise({ name: form.name, bodyRegion: form.bodyRegion,
          category: form.category, tags, equipment, description: form.description })
        showToast('Exercise created', 'success')
      }
      setEditModalOpen(false)
      loadData()
    } catch { showToast('Error saving', 'error') }
  }

  async function deleteExercise(id: string) {
    try {
      await api.deleteExercise(id)
      showToast('Exercise deleted', 'success')
      setDelConfirm(null)
      setDetailExercise(null)
      loadData()
    } catch { showToast('Error deleting', 'error') }
  }

  // --- Level-Exercise CRUD ---
  function openNewLE() {
    setEditingLE(null)
    setLeForm({ exerciseId: '', level: filterLevel || 'A', block: filterBlock || 'ukk',
      order: 1, defaultTempo: '', defaultRPE: '', defaultSxR: '', defaultWeight: '' })
    setLeSearchTerm('')
    setLeModalOpen(true)
  }

  function openEditLE(le: LevelExercise) {
    setEditingLE(le)
    const ex = exerciseMap.get(le.exerciseId)
    setLeForm({
      exerciseId: le.exerciseId, level: le.level, block: le.block,
      order: le.order, defaultTempo: le.defaultTempo || '',
      defaultRPE: le.defaultRPE || '', defaultSxR: le.defaultSxR || '',
      defaultWeight: le.defaultWeight || ''
    })
    setLeSearchTerm(ex?.name || le.exerciseId)
    setLeModalOpen(true)
  }

  async function saveLE() {
    if (!leForm.exerciseId) { showToast('Please select an exercise', 'error'); return }
    try {
      if (editingLE) {
        await api.updateLevelExercise(editingLE.id, leForm)
        showToast('Assignment updated', 'success')
      } else {
        await api.createLevelExercise(leForm)
        showToast('Assignment created', 'success')
      }
      setLeModalOpen(false)
      loadData()
    } catch { showToast('Error saving', 'error') }
  }

  async function deleteLE(id: string) {
    try {
      await api.deleteLevelExercise(id)
      showToast('Assignment deleted', 'success')
      setLeDelConfirm(null)
      loadData()
    } catch { showToast('Error deleting', 'error') }
  }

  // Filtered exercises for LE search dropdown
  const leFilteredExercises = leSearchTerm
    ? exercises.filter(e => e.name.toLowerCase().includes(leSearchTerm.toLowerCase())).slice(0, 10)
    : []

  // --- Media ---
  const mediaForExercise = detailExercise ? media.filter(m => m.exerciseId === detailExercise.id) : []

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !detailExercise) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      await onUploadMedia({
        exerciseId: detailExercise.id, type: file.type.startsWith('video') ? 'video' : 'image',
        data: ev.target?.result as string, name: file.name
      })
      showToast('Medium hochgeladen', 'success')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Count level assignments for an exercise
  function levelCount(exId: string) {
    return levelExercises.filter(le => le.exerciseId === exId).length
  }

  return (
    <div>
      <div className="card-header" style={{ marginBottom: 16 }}>
        <h2 style={{ color: 'var(--text-heading)', margin: 0 }}>Exercise Library</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={openOptionsModal} title="Tag/Equipment Options">⚙</button>
          <button className="btn btn-primary" onClick={openNew}>+ Exercise</button>
        </div>
      </div>

      <div className="sub-tabs">
        <button className={`sub-tab ${subTab === 'library' ? 'active' : ''}`} onClick={() => setSubTab('library')}>
          Master Data ({exercises.length})
        </button>
        <button className={`sub-tab ${subTab === 'levels' ? 'active' : ''}`} onClick={() => setSubTab('levels')}>
          Level Assignments ({levelExercises.length})
        </button>
        <button className={`sub-tab ${subTab === 'progressions' ? 'active' : ''}`} onClick={() => setSubTab('progressions')}>
          Progressions ({progressions.length})
        </button>
      </div>

      {/* Library Tab */}
      {subTab === 'library' && (
        <>
          <div className="exercise-filters">
            <select value={filterBody} onChange={e => setFilterBody(e.target.value)}>
              <option value="">All Regions</option>
              {BODY_REGIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="search-bar">
            <input type="text" placeholder="Search exercises..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {filteredExercises.length === 0 ? (
            <div className="empty-state"><div className="empty-state-text">No exercises found</div></div>
          ) : (
            <div className="card">
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Block</th><th>Bereich</th><th>Kategorie</th><th>Tags</th><th>Levels</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredExercises.map(ex => (
                    <tr key={ex.id}>
                      <td>
                        <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => setDetailExercise(ex)}>
                          {ex.name}
                        </span>
                      </td>
                      <td><span className="badge" style={{ background: 'var(--bg-input)', fontWeight: 600 }}>
                        {getBlockPrefix(ex.bodyRegion, ex.category)}
                      </span></td>
                      <td>{BODY_REGIONS.find(b => b.value === ex.bodyRegion)?.label || ex.bodyRegion}</td>
                      <td><span className="badge" style={{ background: 'var(--bg-input)' }}>
                        {CATEGORIES.find(c => c.value === ex.category)?.label || ex.category}
                      </span></td>
                      <td>{ex.tags.length > 0 ? ex.tags.join(', ') : '-'}</td>
                      <td>{levelCount(ex.id)}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(ex)} style={{ marginRight: 4 }}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelConfirm(ex.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Levels Tab */}
      {subTab === 'levels' && (
        <>
          <div className="exercise-filters" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
              <option value="">All Levels</option>
              {LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}
            </select>
            <select value={filterBlock} onChange={e => setFilterBlock(e.target.value)}>
              <option value="">All Blocks</option>
              {BLOCKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <button className="btn btn-primary" onClick={openNewLE}>+ Assignment</button>
          </div>

          {Object.keys(leGrouped).length === 0 ? (
            <div className="empty-state"><div className="empty-state-text">No assignments found</div></div>
          ) : (
            Object.entries(leGrouped).map(([group, items]) => (
              <div className="card" key={group}>
                <div className="card-title" style={{ marginBottom: 8 }}>{group}</div>
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>Exercise</th><th>Block</th><th>Tempo</th><th>RPE</th><th>SxR</th><th>Weight</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {items.map(le => (
                      <tr key={le.id}>
                        <td>{le.order}</td>
                        <td>
                          <span style={{ cursor: 'pointer', color: 'var(--accent)' }}
                            onClick={() => le.exercise && setDetailExercise(le.exercise)}>
                            {le.exercise?.name || le.exerciseId}
                          </span>
                        </td>
                        <td><span className="badge" style={{ background: 'var(--bg-input)' }}>
                          {BLOCKS.find(b => b.value === le.block)?.label || le.block}
                        </span></td>
                        <td>{le.defaultTempo || '-'}</td>
                        <td>{le.defaultRPE || '-'}</td>
                        <td>{le.defaultSxR || '-'}</td>
                        <td>{le.defaultWeight || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditLE(le)} style={{ marginRight: 4 }}>
                            Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setLeDelConfirm(le.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </>
      )}

      {/* Progressions Tab */}
      {subTab === 'progressions' && (
        <>
          <div className="exercise-filters" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={progFilterBody} onChange={e => setProgFilterBody(e.target.value)}>
              <option value="">All Regions</option>
              {PROG_REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button className="btn btn-primary" onClick={openNewProg}>+ Progression</button>
          </div>
          {filteredProgs.length === 0 ? (
            <div className="empty-state"><div className="empty-state-text">No progressions found</div></div>
          ) : (
            filteredProgs.map(prog => (
              <div className="card" key={prog.id}>
                <div className="card-header">
                  <span className="card-title">{prog.name}</span>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span className="badge" style={{ background: 'var(--bg-input)' }}>
                      {PROG_REGIONS.find(r => r.value === prog.bodyRegion)?.label || prog.bodyRegion}
                    </span>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEditProg(prog)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setProgDelConfirm(prog.id)}>Delete</button>
                  </span>
                </div>
                <div className="progression-chain">
                  {prog.steps.map((s, j) => (
                    <span key={j}>
                      <span className={`progression-step${s.exerciseId ? '' : ' unlinked'}`}>
                        {s.level}: {s.exerciseName}
                      </span>
                      {j < prog.steps.length - 1 && <span className="progression-arrow">&#8594;</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Exercise Detail Modal */}
      <Modal open={!!detailExercise} title={detailExercise?.name || ''} onClose={() => setDetailExercise(null)} maxWidth="700px">
        {detailExercise && (
          <>
            <div style={{ marginBottom: 12 }}>
              <span className="badge badge-level">{BODY_REGIONS.find(b => b.value === detailExercise.bodyRegion)?.label}</span>
              <span className="badge" style={{ background: 'var(--bg-input)', marginLeft: 4 }}>
                {CATEGORIES.find(c => c.value === detailExercise.category)?.label || detailExercise.category}
              </span>
              {detailExercise.tags.map(t => (
                <span key={t} className="badge" style={{ background: 'var(--bg-input)', marginLeft: 4 }}>{t}</span>
              ))}
            </div>
            {detailExercise.description && (
              <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>{detailExercise.description}</p>
            )}
            {detailExercise.equipment.length > 0 && (
              <div style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
                Equipment: {detailExercise.equipment.join(', ')}
              </div>
            )}

            {/* Level assignments for this exercise */}
            {(() => {
              const les = levelExercises.filter(le => le.exerciseId === detailExercise.id)
              return les.length > 0 ? (
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ color: 'var(--text-heading)', marginBottom: 8 }}>Level Assignments</h4>
                  <table className="data-table">
                    <thead><tr><th>Level</th><th>Block</th><th>Tempo</th><th>RPE</th><th>SxR</th></tr></thead>
                    <tbody>
                      {les.map(le => (
                        <tr key={le.id}>
                          <td>Level {le.level}</td>
                          <td>{BLOCKS.find(b => b.value === le.block)?.label || le.block}</td>
                          <td>{le.defaultTempo || '-'}</td>
                          <td>{le.defaultRPE || '-'}</td>
                          <td>{le.defaultSxR || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null
            })()}

            <div style={{ marginBottom: 12 }}>
              <h4 style={{ color: 'var(--text-heading)', marginBottom: 8 }}>Medien</h4>
              <div className="media-upload" onClick={() => fileInputRef.current?.click()}>
                <div style={{ fontSize: 24 }}>&#128247;</div>
                <div>Klicken um Video/Foto hochzuladen</div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileUpload} />
              {mediaForExercise.map(m => (
                <div className="media-preview" style={{ marginTop: 8 }} key={m.id}>
                  {m.type === 'video' ? (
                    <video controls src={m.data} style={{ maxWidth: '100%', borderRadius: 'var(--radius)' }} />
                  ) : (
                    <img src={m.data} style={{ maxWidth: '100%', borderRadius: 'var(--radius)' }} alt={m.name} />
                  )}
                  <button className="btn btn-danger btn-sm" style={{ marginTop: 4 }} onClick={() => { onDeleteMedia(m.id); showToast('Media deleted', 'success') }}>
                    Delete
                  </button>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => openEdit(detailExercise)}>Edit</button>
              <button className="btn btn-secondary" onClick={() => setDetailExercise(null)}>Close</button>
            </div>
          </>
        )}
      </Modal>

      {/* Edit/Create Modal */}
      <Modal open={editModalOpen} title={editingExercise ? 'Edit Exercise' : 'New Exercise'} onClose={() => setEditModalOpen(false)}>
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Body Region</label>
            <select className="form-input" value={form.bodyRegion} onChange={e => setForm(f => ({ ...f, bodyRegion: e.target.value }))}>
              {BODY_REGIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Kategorie</label>
            <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        {Object.entries(tagCategories).map(([category, options]) => {
          const isEquip = category === EQUIPMENT_CATEGORY
          const field = isEquip ? 'equipment' : 'tags'
          const values = isEquip ? form.equipment : form.tags
          return (
            <div className="form-group" key={category}>
              <label className="form-label">{category}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {options.map(opt => {
                  const selected = values.includes(opt)
                  return (
                    <button key={opt} type="button"
                      className={selected ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                      style={{ fontSize: 11, padding: '2px 8px', opacity: selected ? 1 : 0.6 }}
                      onClick={() => setForm(f => ({
                        ...f,
                        [field]: selected ? (f as any)[field].filter((v: string) => v !== opt) : [...(f as any)[field], opt]
                      }))}
                    >{opt}</button>
                  )
                })}
              </div>
            </div>
          )
        })}
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={3} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveExercise}>Save</button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!delConfirm} title="Delete Exercise" onClose={() => setDelConfirm(null)}>
        <p style={{ color: 'var(--text-primary)', marginBottom: 16 }}>
          Delete exercise and all level assignments? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setDelConfirm(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => delConfirm && deleteExercise(delConfirm)}>Delete</button>
        </div>
      </Modal>

      {/* Level-Exercise Assignment Modal */}
      <Modal open={leModalOpen} title={editingLE ? 'Edit Assignment' : 'New Assignment'} onClose={() => setLeModalOpen(false)}>
        <div className="form-group">
          <label className="form-label">Exercise *</label>
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              value={leSearchTerm}
              placeholder="Search exercises..."
              onChange={e => {
                setLeSearchTerm(e.target.value)
                if (!e.target.value) setLeForm(f => ({ ...f, exerciseId: '' }))
              }}
            />
            {leSearchTerm && !leForm.exerciseId && leFilteredExercises.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', maxHeight: 200, overflowY: 'auto'
              }}>
                {leFilteredExercises.map(ex => (
                  <div key={ex.id} style={{
                    padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                    color: 'var(--text-primary)'
                  }}
                    onMouseDown={() => {
                      setLeForm(f => ({ ...f, exerciseId: ex.id }))
                      setLeSearchTerm(ex.name)
                    }}
                  >
                    {ex.name}
                    <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 8 }}>
                      {BODY_REGIONS.find(b => b.value === ex.bodyRegion)?.label} / {ex.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {leForm.exerciseId && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                ID: {leForm.exerciseId}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Level</label>
            <select className="form-input" value={leForm.level}
              onChange={e => setLeForm(f => ({ ...f, level: e.target.value }))}>
              {LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Block</label>
            <select className="form-input" value={leForm.block}
              onChange={e => setLeForm(f => ({ ...f, block: e.target.value }))}>
              {BLOCKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Reihenfolge</label>
            <input className="form-input" type="number" min={1} value={leForm.order}
              onChange={e => setLeForm(f => ({ ...f, order: parseInt(e.target.value) || 1 }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Tempo</label>
            <input className="form-input" value={leForm.defaultTempo} placeholder="e.g. 3-1-1-0"
              onChange={e => setLeForm(f => ({ ...f, defaultTempo: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">RPE</label>
            <input className="form-input" value={leForm.defaultRPE} placeholder="e.g. 7-8"
              onChange={e => setLeForm(f => ({ ...f, defaultRPE: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">SxR (Sets x Reps)</label>
            <input className="form-input" value={leForm.defaultSxR} placeholder="e.g. 3x10"
              onChange={e => setLeForm(f => ({ ...f, defaultSxR: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Weight</label>
            <input className="form-input" value={leForm.defaultWeight} placeholder="e.g. 20kg"
              onChange={e => setLeForm(f => ({ ...f, defaultWeight: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={() => setLeModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveLE}>Save</button>
        </div>
      </Modal>

      {/* Level-Exercise Delete Confirm */}
      <Modal open={!!leDelConfirm} title="Delete Assignment" onClose={() => setLeDelConfirm(null)}>
        <p style={{ color: 'var(--text-primary)', marginBottom: 16 }}>
          Really delete this level assignment?
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setLeDelConfirm(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => leDelConfirm && deleteLE(leDelConfirm)}>Delete</button>
        </div>
      </Modal>

      {/* Progression Edit/Create Modal */}
      <Modal open={progModalOpen} title={editingProg ? 'Edit Progression' : 'New Progression'} onClose={() => setProgModalOpen(false)} maxWidth="800px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" value={progForm.name}
              onChange={e => setProgForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Bereich</label>
            <select className="form-input" value={progForm.bodyRegion}
              onChange={e => setProgForm(f => ({ ...f, bodyRegion: e.target.value }))}>
              {PROG_REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="form-label" style={{ margin: 0 }}>Schritte ({progForm.steps.length})</label>
          <button className="btn btn-secondary btn-sm" onClick={addProgStep}>+ Schritt</button>
        </div>

        <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 8 }}>
          {progForm.steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input className="form-input" style={{ width: 60 }} placeholder="Level"
                value={step.level} onChange={e => updateProgStep(i, 'level', e.target.value)} />
              <input className="form-input" style={{ flex: 1 }} placeholder="Exercise name"
                value={step.exerciseName} onChange={e => updateProgStep(i, 'exerciseName', e.target.value)} />
              <span style={{ fontSize: 11, color: step.exerciseId ? 'var(--accent)' : 'var(--text-secondary)', minWidth: 20 }}>
                {step.exerciseId ? '\u2713' : ''}
              </span>
              <button className="btn btn-danger btn-sm" onClick={() => removeProgStep(i)} style={{ padding: '2px 6px' }}>
                x
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-secondary" onClick={() => setProgModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveProg}>Save</button>
        </div>
      </Modal>

      {/* Progression Delete Confirm */}
      <Modal open={!!progDelConfirm} title="Delete Progression" onClose={() => setProgDelConfirm(null)}>
        <p style={{ color: 'var(--text-primary)', marginBottom: 16 }}>
          Really delete this progression?
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setProgDelConfirm(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => progDelConfirm && deleteProg(progDelConfirm)}>Delete</button>
        </div>
      </Modal>

      {/* Category Options Modal */}
      <Modal open={optionsModalOpen} title="Category Options" onClose={() => setOptionsModalOpen(false)}>
        <div className="form-group">
          <label className="form-label">Categories (one per line: Category: option1, option2, ...)</label>
          <textarea className="form-input" rows={10} value={optionsCatsStr}
            onChange={e => setOptionsCatsStr(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 12 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => setOptionsModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveOptions}>Save</button>
        </div>
      </Modal>
    </div>
  )
}
