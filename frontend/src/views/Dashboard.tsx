import type { Player, WeekPlan, ViewId } from '../types'

interface Props {
  players: Player[]
  plans: WeekPlan[]
  mediaCount: number
  exerciseCount: number
  onNavigate: (view: ViewId) => void
}

export function Dashboard({ players, plans, mediaCount, exerciseCount, onNavigate }: Props) {
  const lastPlayers = players.slice(0, 5)
  const lastPlans = [...plans].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5)

  return (
    <div>
      <h2 style={{ color: 'var(--text-heading)', marginBottom: 16 }}>Dashboard</h2>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{players.length}</div>
          <div className="stat-label">Spieler</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{plans.length}</div>
          <div className="stat-label">Wochenpläne</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{exerciseCount}</div>
          <div className="stat-label">Übungen</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{mediaCount}</div>
          <div className="stat-label">Medien</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Aktuelle Spieler</span>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('players')}>
              Alle anzeigen
            </button>
          </div>
          {lastPlayers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text" style={{ fontSize: 13 }}>
                Noch keine Spieler angelegt
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Level</th></tr>
              </thead>
              <tbody>
                {lastPlayers.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="badge badge-level">Level {p.level}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Letzte Wochenpläne</span>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('planner')}>
              Neue Planung
            </button>
          </div>
          {lastPlans.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text" style={{ fontSize: 13 }}>
                Noch keine Wochenpläne erstellt
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Spieler</th><th>Woche</th><th>RPE</th></tr>
              </thead>
              <tbody>
                {lastPlans.map(pl => {
                  const player = players.find(p => p.id === pl.playerId)
                  return (
                    <tr key={pl.id}>
                      <td>{player ? player.name : 'Unbekannt'}</td>
                      <td>{pl.week || ''}</td>
                      <td>{pl.totalRPE || 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
