import { useState, useEffect, useRef } from 'react'
import { Modal } from '../components/Modal'
import type { Media, Exercise, ExercisesData, ProgressionsData, Progression, ToastType } from '../types'

interface WarmupData {
  categories?: Progression[]
}

interface Props {
  media: Media[]
  onUploadMedia: (m: Omit<Media, 'id' | 'createdAt'>) => Promise<void>
  onDeleteMedia: (id: string) => Promise<void>
  showToast: (msg: string, type: ToastType) => void
}

interface FlatExercise extends Exercise {
  level: string
  bodyPart: string
  block: string
}

function flattenExercises(data: ExercisesData | null): FlatExercise[] {
  if (!data?.levels) return []
  const flat: FlatExercise[] = []
  for (const [level, bodyParts] of Object.entries(data.levels)) {
    for (const bodyPart of ['lowerBody', 'upperBody'] as const) {
      const plan = bodyParts[bodyPart]
      if (!plan) continue
      for (const block of ['explosiv', 'strengthA', 'strengthB', 'isometrics']) {
        const exercises = (plan as Record<string, Exercise[]>)[block]
        if (!exercises) continue
        exercises.forEach(ex => {
          flat.push({ ...ex, level, bodyPart, block })
        })
      }
    }
  }
  return flat
}

export function Exercises({ media, onUploadMedia, onDeleteMedia, showToast }: Props) {
  const [exercisesData, setExercisesData] = useState<ExercisesData | null>(null)
  const [progressionsData, setProgressionsData] = useState<ProgressionsData | null>(null)
  const [warmupData, setWarmupData] = useState<WarmupData | null>(null)

  const [subTab, setSubTab] = useState<'list' | 'progressions'>('list')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterBody, setFilterBody] = useState('')
  const [filterBlock, setFilterBlock] = useState('')
  const [search, setSearch] = useState('')
  const [progFilterBody, setProgFilterBody] = useState('')

  const [detailExercise, setDetailExercise] = useState<FlatExercise | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    Promise.all([
      load('exercises.json'),
      load('progressions.json'),
      load('warmup.json')
    ]).then(([ex, prog, wu]) => {
      setExercisesData(ex)
      setProgressionsData(prog)
      setWarmupData(wu)
    })
  }, [])

  const allExercises = flattenExercises(exercisesData)

  let filteredExercises = allExercises
  if (filterLevel) filteredExercises = filteredExercises.filter(e => e.level === filterLevel)
  if (filterBody) filteredExercises = filteredExercises.filter(e => e.bodyPart === filterBody)
  if (filterBlock) filteredExercises = filteredExercises.filter(e => e.block === filterBlock)
  if (search) filteredExercises = filteredExercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))

  // Group exercises
  const grouped: Record<string, FlatExercise[]> = {}
  filteredExercises.forEach(ex => {
    const key = `Level ${ex.level} - ${ex.bodyPart === 'lowerBody' ? 'Unterkörper' : 'Oberkörper'}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(ex)
  })

  // Progressions
  const progs = progressionsData || { lowerBody: [], upperBody: [] }
  const warmup = warmupData || { categories: [] }
  let allProgs: (Progression & { source: string })[] = []
  if (!progFilterBody || progFilterBody === 'lowerBody') {
    (progs.lowerBody || []).forEach(p => allProgs.push({ ...p, source: 'Unterkörper' }))
  }
  if (!progFilterBody || progFilterBody === 'upperBody') {
    (progs.upperBody || []).forEach(p => allProgs.push({ ...p, source: 'Oberkörper' }))
  }
  if (!progFilterBody) {
    (warmup.categories || []).forEach(p => allProgs.push({ ...p, source: 'Warm-Up' }))
  }

  const mediaForExercise = detailExercise
    ? media.filter(m => m.exerciseId === detailExercise.id)
    : []

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !detailExercise) return

    const reader = new FileReader()
    reader.onload = async (ev) => {
      await onUploadMedia({
        exerciseId: detailExercise.id,
        type: file.type.startsWith('video') ? 'video' : 'image',
        data: ev.target?.result as string,
        name: file.name
      })
      showToast('Medium hochgeladen', 'success')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleDeleteMedia = async (mediaId: string) => {
    await onDeleteMedia(mediaId)
    showToast('Medium gelöscht', 'success')
  }

  const levels = ['A','B','C','D','E','F','1','2','3','4','5','6']

  return (
    <div>
      <h2 style={{ color: 'var(--text-heading)', marginBottom: 16 }}>Übungsbibliothek</h2>

      <div className="sub-tabs">
        <button
          className={`sub-tab ${subTab === 'list' ? 'active' : ''}`}
          onClick={() => setSubTab('list')}
        >
          Übungen
        </button>
        <button
          className={`sub-tab ${subTab === 'progressions' ? 'active' : ''}`}
          onClick={() => setSubTab('progressions')}
        >
          Progressionen
        </button>
      </div>

      {subTab === 'list' && (
        <>
          <div className="exercise-filters">
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
              <option value="">Alle Level</option>
              {levels.map(l => <option key={l} value={l}>Level {l}</option>)}
            </select>
            <select value={filterBody} onChange={e => setFilterBody(e.target.value)}>
              <option value="">Alle Bereiche</option>
              <option value="lowerBody">Unterkörper</option>
              <option value="upperBody">Oberkörper</option>
            </select>
            <select value={filterBlock} onChange={e => setFilterBlock(e.target.value)}>
              <option value="">Alle Blöcke</option>
              <option value="explosiv">Explosiv</option>
              <option value="strengthA">Kraft A</option>
              <option value="strengthB">Kraft B</option>
              <option value="isometrics">Isometrics</option>
            </select>
          </div>

          <div className="search-bar">
            <input
              type="text"
              placeholder="Übung suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {filteredExercises.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text">Keine Übungen gefunden</div>
            </div>
          ) : (
            Object.entries(grouped).map(([group, exs]) => (
              <div className="card" key={group}>
                <div className="card-title" style={{ marginBottom: 8 }}>{group}</div>
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>Übung</th><th>Block</th><th>RPE</th><th>SxR</th></tr>
                  </thead>
                  <tbody>
                    {exs.map((ex, i) => (
                      <tr
                        key={ex.id || `${group}-${i}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setDetailExercise(ex)}
                      >
                        <td>{ex.order || ''}</td>
                        <td>{ex.name}</td>
                        <td><span className="badge" style={{ background: 'var(--bg-input)' }}>{ex.block}</span></td>
                        <td>{ex.defaultRPE || ex.tempo || '-'}</td>
                        <td>{ex.defaultSxR || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </>
      )}

      {subTab === 'progressions' && (
        <>
          <div className="exercise-filters">
            <select value={progFilterBody} onChange={e => setProgFilterBody(e.target.value)}>
              <option value="">Alle Bereiche</option>
              <option value="lowerBody">Unterkörper</option>
              <option value="upperBody">Oberkörper</option>
            </select>
          </div>

          {allProgs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text">Keine Progressionen gefunden</div>
            </div>
          ) : (
            allProgs.map((prog, i) => (
              <div className="card" key={prog.id || prog.name || i}>
                <div className="card-header">
                  <span className="card-title">{prog.name || prog.fullName || prog.id}</span>
                  <span className="badge" style={{ background: 'var(--bg-input)' }}>{prog.source}</span>
                </div>
                <div className="progression-chain">
                  {(prog.levels || []).map((l, j) => (
                    <span key={j}>
                      <span className="progression-step">{l.level}: {l.exercise}</span>
                      {j < (prog.levels?.length || 0) - 1 && (
                        <span className="progression-arrow">&#8594;</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Exercise Detail Modal */}
      <Modal
        open={!!detailExercise}
        title={detailExercise?.name || ''}
        onClose={() => setDetailExercise(null)}
        maxWidth="700px"
      >
        {detailExercise && (
          <>
            <div style={{ marginBottom: 12 }}>
              <span className="badge badge-level">Level {detailExercise.level}</span>
              <span className="badge" style={{ background: 'var(--bg-input)', marginLeft: 4 }}>
                {detailExercise.bodyPart === 'lowerBody' ? 'Unterkörper' : 'Oberkörper'}
              </span>
              <span className="badge" style={{ background: 'var(--bg-input)', marginLeft: 4 }}>
                {detailExercise.block}
              </span>
            </div>
            <div className="exercise-details" style={{ marginBottom: 16 }}>
              <div className="detail-item"><div className="detail-label">Tempo</div><div className="detail-value">{detailExercise.tempo || detailExercise.defaultRPE || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">RPE</div><div className="detail-value">{detailExercise.defaultRPE || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">SxR</div><div className="detail-value">{detailExercise.defaultSxR || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">Gewicht</div><div className="detail-value">{detailExercise.defaultWeight || '-'}</div></div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <h4 style={{ color: 'var(--text-heading)', marginBottom: 8 }}>Medien</h4>
              <div
                className="media-upload"
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ fontSize: 24 }}>&#128247;</div>
                <div>Klicken um Video/Foto hochzuladen</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              {mediaForExercise.map(m => (
                <div className="media-preview" style={{ marginTop: 8 }} key={m.id}>
                  {m.type === 'video' ? (
                    <video controls src={m.data} style={{ maxWidth: '100%', borderRadius: 'var(--radius)' }} />
                  ) : (
                    <img src={m.data} style={{ maxWidth: '100%', borderRadius: 'var(--radius)' }} alt={m.name} />
                  )}
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ marginTop: 4 }}
                    onClick={() => handleDeleteMedia(m.id)}
                  >
                    Löschen
                  </button>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDetailExercise(null)}>Schließen</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
