import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../lib/format'

const DOT_COUNT = 5

interface Props {
  balance: number
  /** Movements logged today. Values above DOT_COUNT simply fill every dot. */
  todayCount: number
  currency: string
  locale: string
  owedToMe: number
  iOwe: number
  onOpenDebts: () => void
}

export function BalanceCard({ balance, todayCount, currency, locale, owedToMe, iOwe, onOpenDebts }: Props) {
  // Which "lap" we're on and where in the current lap we are.
  const lap = Math.floor(todayCount / DOT_COUNT)
  const pos = todayCount % DOT_COUNT  // 0 means just completed a full lap

  // Index of the dot that just lit up (for the pop animation).
  // When pos===0 we just filled the last dot of a lap — index DOT_COUNT-1.
  const newDotIndex = todayCount === 0 ? -1 : pos === 0 ? DOT_COUNT - 1 : pos - 1

  const previous = useRef(newDotIndex)
  const [popIndex, setPopIndex] = useState<number | null>(null)

  useEffect(() => {
    if (todayCount > 0 && newDotIndex !== previous.current) {
      setPopIndex(newDotIndex)
      const t = setTimeout(() => setPopIndex(null), 260)
      previous.current = newDotIndex
      return () => clearTimeout(t)
    }
    previous.current = newDotIndex
  }, [newDotIndex, todayCount])

  // Determine the visual state of each dot.
  // lap 0 → normal fill up to pos.
  // lap ≥ 1 → all dots on; dots < pos are "alert" (overwritten this cycle).
  function dotState(i: number): 'off' | 'on' | 'alert' {
    if (lap === 0) return i < todayCount ? 'on' : 'off'
    // When pos===0 (exactly completed a lap) all dots are 'on', none alert yet.
    if (pos === 0) return 'on'
    return i < pos ? 'alert' : 'on'
  }

  return (
    <section className="balance" aria-labelledby="balance-label">
      <span className="sr-only" id="balance-label">
        Saldo actual
      </span>

      <output className="balance__amount" aria-live="polite">
        {formatMoney(balance, currency, locale)}
      </output>

      <div
        className="dots"
        role="img"
        aria-label={`${todayCount} ${todayCount === 1 ? 'gasto' : 'gastos'} anotados hoy`}
      >
        {Array.from({ length: DOT_COUNT }, (_, i) => {
          const state = dotState(i)
          return (
            <span
              key={i}
              className={[
                'dot',
                state === 'on' ? 'dot--on' : '',
                state === 'alert' ? 'dot--alert' : '',
                i === popIndex ? 'dot--pop' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          )
        })}
      </div>

      {(owedToMe > 0 || iOwe > 0) && (
        <DebtScale owedToMe={owedToMe} iOwe={iOwe} currency={currency} locale={locale} onOpen={onOpenDebts} />
      )}
    </section>
  )
}

const TICKS = 21

/**
 * A Braun-style dial scale: zero sits at the centre, what I owe pulls the
 * needle left, what I'm owed pulls it right. The needle is the only orange
 * mark, so it reads like the pointer on a T3 radio rather than a badge.
 */
function DebtScale({
  owedToMe,
  iOwe,
  currency,
  locale,
  onOpen,
}: {
  owedToMe: number
  iOwe: number
  currency: string
  locale: string
  onOpen: () => void
}) {
  const total = owedToMe + iOwe
  // 0% = all debt is mine, 100% = all is owed to me, 50% = they cancel out.
  const needle = total > 0 ? 50 + ((owedToMe - iOwe) / total) * 50 : 50
  const owe = formatMoney(iOwe, currency, locale)
  const owed = formatMoney(owedToMe, currency, locale)

  return (
    <button
      type="button"
      className="dscale"
      onClick={onOpen}
      aria-label={`Te deben ${owed}, debés ${owe}. Ver préstamos`}
    >
      <span className="dscale__labels" aria-hidden="true">
        <span>
          debés <span className="dscale__num">{owe}</span>
        </span>
        <span>
          te deben <span className="dscale__num">{owed}</span>
        </span>
      </span>
      <span className="dscale__track" aria-hidden="true">
        {Array.from({ length: TICKS }, (_, i) => (
          <span
            key={i}
            className={`dscale__tick${i === (TICKS - 1) / 2 ? ' dscale__tick--zero' : i % 5 === 0 ? ' dscale__tick--major' : ''}`}
          />
        ))}
        <span className="dscale__needle" style={{ insetInlineStart: `${needle}%` }} />
      </span>
    </button>
  )
}
