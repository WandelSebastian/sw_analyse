import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  level: string
  blockId: string
  durationMinutes: number
  initialRemaining?: number
  onStateChange?: (remaining: number, running: boolean) => void
  onFinished?: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
}

export function ExerciseTimer({ durationMinutes, initialRemaining, onStateChange, onFinished }: Props) {
  const totalSeconds = durationMinutes * 60
  const [remaining, setRemaining] = useState(initialRemaining ?? totalSeconds)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  useEffect(() => {
    onStateChange?.(remaining, running)
  }, [remaining, running, onStateChange])

  const handleToggle = () => {
    if (running) {
      // Pause
      clearTimer()
      setRunning(false)
    } else {
      // Start / Resume
      let cur = remaining
      if (cur <= 0) {
        cur = totalSeconds
        setRemaining(cur)
      }
      setRunning(true)
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          const next = Math.max(0, prev - 1)
          if (next === 0) {
            clearTimer()
            setRunning(false)
            onFinished?.()
          }
          return next
        })
      }, 1000)
    }
  }

  const handleStop = () => {
    clearTimer()
    setRunning(false)
    setRemaining(totalSeconds)
  }

  const pct = totalSeconds > 0 ? remaining / totalSeconds : 1
  const progressWidth = totalSeconds > 0 ? ((1 - remaining / totalSeconds) * 100).toFixed(1) : '0'
  const displayClass = 'timer-display' + (pct < 0.1 ? ' danger' : pct < 0.25 ? ' warning' : '')
  const progressColor = pct < 0.1 ? 'var(--danger)' : pct < 0.25 ? 'var(--warning)' : 'var(--accent)'

  const buttonLabel = running
    ? '\u23f8 Pause'
    : (remaining < totalSeconds && remaining > 0 ? '\u25b6 Weiter' : '\u25b6 Start')

  return (
    <div className="timer-section">
      <div className="timer-label">Verbleibende Trainingszeit</div>
      <div className={displayClass}>{formatTime(remaining)}</div>
      <div className="timer-total">Gesamt: {formatTime(totalSeconds)}</div>
      <div className="timer-progress-wrap">
        <div
          className="timer-progress-bar"
          style={{ width: `${progressWidth}%`, background: progressColor }}
        />
      </div>
      <div className="timer-controls">
        <button
          className={`btn ${running ? 'btn-secondary' : 'btn-primary'}`}
          onClick={handleToggle}
        >
          {buttonLabel}
        </button>
        <button className="btn btn-danger" onClick={handleStop}>
          &#9632; Beenden
        </button>
      </div>
    </div>
  )
}
