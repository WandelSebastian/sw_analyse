import { useState, useEffect, useCallback } from 'react'
import { api } from './api/client'
import { useToast } from './hooks/useToast'
import { Toast } from './components/Toast'
import { Dashboard } from './views/Dashboard'
import { Players } from './views/Players'
import { Planner } from './views/Planner'
import { Exercises } from './views/Exercises'
import { PlayerView } from './views/PlayerView'
import type { Player, WeekPlan, Media, ViewId } from './types'

const NAV_ITEMS: { id: ViewId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'planner', label: 'Wochenplanung' },
  { id: 'players', label: 'Spieler' },
  { id: 'exercises', label: 'Bibliothek' },
  { id: 'player-view', label: 'Spieler-Ansicht' },
]

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [view, setView] = useState<ViewId>('dashboard')
  const [players, setPlayers] = useState<Player[]>([])
  const [plans, setPlans] = useState<WeekPlan[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [exerciseCount, setExerciseCount] = useState(0)
  const { toasts, showToast, removeToast } = useToast()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '')
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
  }

  const loadData = useCallback(async () => {
    try {
      const [p, pl, m] = await Promise.all([api.getPlayers(), api.getWeekPlans(), api.getMedia()])
      setPlayers(p)
      setPlans(pl)
      setMedia(m)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Load exercise count from static data
  useEffect(() => {
    fetch('/data/exercises.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.levels) return
        let count = 0
        for (const bodyParts of Object.values(data.levels) as Record<string, Record<string, unknown[]>>[]) {
          for (const bodyPart of ['lowerBody', 'upperBody']) {
            const plan = bodyParts[bodyPart]
            if (!plan) continue
            for (const block of ['explosiv', 'strengthA', 'strengthB', 'isometrics']) {
              if (plan[block]) count += (plan[block] as unknown[]).length
            }
          }
        }
        setExerciseCount(count)
      })
      .catch(() => {})
  }, [])

  const handleSavePlayer = async (p: Omit<Player, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (p.id) {
      await api.updatePlayer(p.id, p)
    } else {
      await api.createPlayer(p)
    }
    await loadData()
  }

  const handleDeletePlayer = async (id: string) => {
    await api.deletePlayer(id)
    await loadData()
  }

  const handleUploadMedia = async (m: Omit<Media, 'id' | 'createdAt'>) => {
    await api.createMedia(m)
    await loadData()
  }

  const handleDeleteMedia = async (id: string) => {
    await api.deleteMedia(id)
    await loadData()
  }

  const handleViewPlan = (_playerId: string) => {
    setView('player-view')
  }

  return (
    <>
      <header className="app-header">
        <div className="app-logo">Krafttraining</div>
        <nav className="nav-tabs">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-tab ${view === item.id ? 'active' : ''}`}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button className="btn-icon" onClick={toggleTheme} title="Theme wechseln">
            {theme === 'light' ? '\u2600' : '\u263E'}
          </button>
        </div>
      </header>

      <div className="view active">
        {view === 'dashboard' && (
          <Dashboard
            players={players}
            plans={plans}
            mediaCount={media.length}
            exerciseCount={exerciseCount}
            onNavigate={setView}
          />
        )}

        {view === 'players' && (
          <Players
            players={players}
            onSave={handleSavePlayer}
            onDelete={handleDeletePlayer}
            showToast={showToast}
            onViewPlan={handleViewPlan}
          />
        )}

        {view === 'planner' && (
          <Planner
            players={players}
            showToast={showToast}
          />
        )}

        {view === 'exercises' && (
          <Exercises
            media={media}
            onUploadMedia={handleUploadMedia}
            onDeleteMedia={handleDeleteMedia}
            showToast={showToast}
          />
        )}

        {view === 'player-view' && (
          <PlayerView
            players={players}
            showToast={showToast}
          />
        )}
      </div>

      <Toast toasts={toasts} onRemove={removeToast} />
    </>
  )
}
