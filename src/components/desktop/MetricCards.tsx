import { useMemo } from 'react'
import type { Movement } from '../../types'
import { formatMoney } from '../../lib/format'

export interface MetricCardsProps {
  movements: Movement[]
  currency: string
  locale: string
}

const CATEGORY_GLYPHS: Record<string, string> = {
  Comida: '🍔',
  Transporte: '🚗',
  Hogar: '🏠',
  Salud: '💊',
  Mascotas: '🐾',
  Ocio: '🎟️',
  Compras: '🛍️',
  Servicios: '💡',
  Trabajo: '💼',
  Otros: '🏷️',
}

export function MetricCards({ movements, currency, locale }: MetricCardsProps) {
  const stats = useMemo(() => {
    let gastos = 0
    let ingresos = 0
    const catMap: Record<string, number> = {}

    for (const m of movements) {
      if (m.kind === 'gasto') {
        gastos += m.amount
        catMap[m.category] = (catMap[m.category] || 0) + m.amount
      } else {
        ingresos += m.amount
      }
    }

    let topCat = ''
    let topCatAmount = 0
    for (const [cat, amt] of Object.entries(catMap)) {
      if (amt > topCatAmount) {
        topCat = cat
        topCatAmount = amt
      }
    }

    const glyph = topCat ? (CATEGORY_GLYPHS[topCat] ?? '🏷️') : ''

    return {
      gastos,
      ingresos,
      net: ingresos - gastos,
      topCat: topCat ? `${glyph} ${topCat}` : '—',
      topCatAmount,
    }
  }, [movements])

  return (
    <div className="desk-metrics">
      <div className="desk-metric-card">
        <span className="desk-metric-card__label">Gastos del mes</span>
        <span className="desk-metric-card__value">
          −{formatMoney(stats.gastos, currency, locale)}
        </span>
      </div>

      <div className="desk-metric-card">
        <span className="desk-metric-card__label">Ingresos del mes</span>
        <span className="desk-metric-card__value desk-metric-card__value--pos">
          +{formatMoney(stats.ingresos, currency, locale)}
        </span>
      </div>

      <div className="desk-metric-card">
        <span className="desk-metric-card__label">Balance neto</span>
        <span
          className={`desk-metric-card__value${
            stats.net >= 0 ? ' desk-metric-card__value--pos' : ''
          }`}
        >
          {formatMoney(stats.net, currency, locale)}
        </span>
      </div>

      <div className="desk-metric-card">
        <span className="desk-metric-card__label">Categoría principal</span>
        <span className="desk-metric-card__value desk-metric-card__value--cat">
          {stats.topCat}
        </span>
        {stats.topCatAmount > 0 && (
          <span className="desk-metric-card__sub">
            {formatMoney(stats.topCatAmount, currency, locale)}
          </span>
        )}
      </div>
    </div>
  )
}
