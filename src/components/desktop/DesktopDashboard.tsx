import type { Movement } from '../../types'

export interface DesktopDashboardProps {
  movements: Movement[]
  anchor: Date
  currency: string
  locale: string
  onUpdateCategory: (id: string, category: string) => void
  onUpdateMovement: (id: string, patch: Partial<Omit<Movement, 'id' | 'createdAt'>>) => void
  onDeleteMovement: (id: string) => void
}

export function DesktopDashboard(_props: DesktopDashboardProps) {
  return (
    <div className="desk-dash">
      <div className="desk-dash__placeholder">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)' }}>
          Panel de Control
        </h2>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem', marginBlockStart: '0.5rem' }}>
          Cargando métricas y calendario...
        </p>
      </div>
    </div>
  )
}
