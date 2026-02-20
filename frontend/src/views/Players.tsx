import { useState } from 'react'
import { Modal } from '../components/Modal'
import type { Player, ToastType } from '../types'

interface Props {
  players: Player[]
  onSave: (p: Omit<Player, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  showToast: (msg: string, type: ToastType) => void
  onViewPlan: (playerId: string) => void
}

const LEVELS = ['A','B','C','D','E','F','1','2','3','4','5','6','7','8','9']

export function Players({ players, onSave, onDelete, showToast, onViewPlan }: Props) {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', height: '', weight: '', level: 'A', dob: '', notes: ''
  })

  const filtered = players.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => {
    setEditId(null)
    setForm({ name: '', height: '', weight: '', level: 'A', dob: '', notes: '' })
    setModalOpen(true)
  }

  const openEdit = (p: Player) => {
    setEditId(p.id)
    setForm({
      name: p.name,
      height: p.height || '',
      weight: p.weight || '',
      level: p.level,
      dob: p.dob || '',
      notes: p.notes || ''
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('Bitte Namen eingeben', 'error')
      return
    }
    await onSave({
      ...(editId ? { id: editId } : {}),
      name: form.name.trim(),
      height: form.height || undefined,
      weight: form.weight || undefined,
      level: form.level,
      dob: form.dob || undefined,
      notes: form.notes
    })
    setModalOpen(false)
    showToast(editId ? 'Spieler aktualisiert' : 'Spieler angelegt', 'success')
  }

  const confirmDelete = (p: Player) => {
    setDeleteTarget(p)
    setConfirmOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await onDelete(deleteTarget.id)
    setConfirmOpen(false)
    setDeleteTarget(null)
    showToast('Spieler gelöscht', 'success')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ color: 'var(--text-heading)' }}>Spieler-Verwaltung</h2>
        <button className="btn btn-primary" onClick={openAdd}>+ Spieler anlegen</button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Spieler suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-3">
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state-icon">&#128100;</div>
            <div className="empty-state-text">
              {search ? 'Keine Spieler gefunden' : 'Noch keine Spieler angelegt'}
            </div>
          </div>
        ) : (
          filtered.map(p => (
            <div className="card" key={p.id}>
              <div className="card-header">
                <span className="card-title">{p.name}</span>
                <span className="badge badge-level">Level {p.level}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {p.height ? p.height + ' cm' : ''}
                {p.height && p.weight ? ' | ' : ''}
                {p.weight ? p.weight + ' kg' : ''}
                {p.dob ? <><br />{p.dob}</> : null}
              </div>
              {p.notes && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, fontStyle: 'italic' }}>
                  {p.notes}
                </div>
              )}
              <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Bearbeiten</button>
                <button className="btn btn-danger btn-sm" onClick={() => confirmDelete(p)}>Löschen</button>
                <button className="btn btn-primary btn-sm" onClick={() => onViewPlan(p.id)}>Plan ansehen</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        title={editId ? 'Spieler bearbeiten' : 'Spieler anlegen'}
        onClose={() => setModalOpen(false)}
      >
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input
            type="text"
            className="form-input"
            placeholder="Vorname Nachname"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Größe (cm)</label>
            <input
              type="number"
              className="form-input"
              placeholder="180"
              value={form.height}
              onChange={e => setForm(f => ({ ...f, height: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Gewicht (kg)</label>
            <input
              type="number"
              className="form-input"
              placeholder="75"
              value={form.weight}
              onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Level *</label>
            <select
              className="form-select"
              value={form.level}
              onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
            >
              {LEVELS.map(l => (
                <option key={l} value={l}>Level {l}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Geburtsdatum</label>
            <input
              type="date"
              className="form-input"
              value={form.dob}
              onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notizen</label>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Verletzungen, Besonderheiten..."
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Abbrechen</button>
          <button className="btn btn-primary" onClick={handleSave}>Speichern</button>
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal
        open={confirmOpen}
        title="Spieler löschen"
        onClose={() => setConfirmOpen(false)}
        maxWidth="420px"
      >
        <div className="dialog-message">
          Soll <strong>{deleteTarget?.name}</strong> wirklich gelöscht werden?
          Alle zugehörigen Wochenpläne bleiben erhalten.
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>Abbrechen</button>
          <button className="btn btn-danger" onClick={handleDelete}>Ja, bestätigen</button>
        </div>
      </Modal>
    </div>
  )
}
