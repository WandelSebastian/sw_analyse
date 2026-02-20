import type { ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}

export function Modal({ open, title, onClose, children, maxWidth }: Props) {
  if (!open) return null

  return (
    <div className="modal-overlay active" onClick={(e) => {
      if (e.target === e.currentTarget) onClose()
    }}>
      <div className="modal" style={maxWidth ? { maxWidth } : undefined}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  )
}
