import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './app.css'

import { BalanceCard } from './components/BalanceCard'
import { ChatBar, type ChatNote } from './components/ChatBar'
import { HistoryPage } from './components/HistorySheet'
import { MovementList } from './components/MovementList'
import { RangeNav } from './components/RangeNav'
import { SettingsSheet } from './components/SettingsSheet'
import { DesktopDashboard } from './components/desktop/DesktopDashboard'
import { HistoryIcon, MenuIcon } from './components/icons'

import {
  addDays,
  fromISODate,
  isInWeekOf,
  isSameMonth,
  monthLabel,
  startOfWeek,
  todayISO,
  toISODate,
  weekdayIndex,
} from './lib/dates'
import { formatMoney } from './lib/format'
import { parseMessage } from './lib/llm'
import {
  loadMovements,
  loadSettings,
  newId,
  saveMovements,
  saveSettings,
} from './lib/storage'
import { applyTheme, watchSystemTheme } from './lib/theme'
import {
  clearRemoteMovements,
  deleteRemoteMovement,
  fetchRemoteMovements,
  onAuthStateChange,
  signInWithGoogle,
  signOut,
  syncMovementsToCloud,
} from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Movement, Scope, Settings, Tab } from './types'

export default function App() {
  const [movements, setMovements] = useState<Movement[]>(loadMovements)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [user, setUser] = useState<User | null>(null)

  const [scope, setScope] = useState<Scope>('mes')
  const [tab, setTab] = useState<Tab>('periodo')
  /** Anchor for the visible month/week; stepping moves this, not "today". */
  const [anchor, setAnchor] = useState<Date>(() => new Date())

  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<ChatNote | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  /** Measured height of the floating chat bar, so the list can clear it. */
  const [chatHeight, setChatHeight] = useState(68)

  // Listen to Supabase Auth state and auto-sync movements on login
  useEffect(() => {
    return onAuthStateChange((_session, currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        // Sync local movements to cloud and download remote movements
        void (async () => {
          const remote = await fetchRemoteMovements(currentUser.id, settings)
          setMovements((local) => {
            const map = new Map<string, Movement>()
            // Put remote first, then override with local to preserve recent edits
            for (const m of remote) map.set(m.id, m)
            for (const m of local) map.set(m.id, m)
            const merged = Array.from(map.values())
            void syncMovementsToCloud(currentUser.id, merged, settings)
            return merged
          })
        })()
      }
    }, settings)
  }, [settings])

  useEffect(() => saveMovements(movements), [movements])
  useEffect(() => saveSettings(settings), [settings])

  // Appearance: paint before first frame, then follow the OS while on 'system'.
  useLayoutEffect(() => applyTheme(settings.theme), [settings.theme])
  useEffect(() => {
    if (settings.theme !== 'system') return
    return watchSystemTheme(() => applyTheme('system'))
  }, [settings.theme])

  /* ------------------------------------------------------------ derived -- */

  const balance = useMemo(
    () =>
      movements.reduce(
        (sum, m) => sum + (m.kind === 'ingreso' ? m.amount : -m.amount),
        0,
      ),
    [movements],
  )

  const today = todayISO()
  const todayCount = useMemo(
    () => movements.filter((m) => m.date === today && m.kind === 'gasto').length,
    [movements, today],
  )

  /** The movements the current scope + tab selects. */
  const visible = useMemo(() => {
    const inScope = movements.filter((m) =>
      scope === 'mes' ? isSameMonth(m.date, anchor) : isInWeekOf(m.date, anchor),
    )

    if (tab === 'periodo') return inScope
    if (tab === 'hoy') return inScope.filter((m) => m.date === today)
    if (tab === 'ayer') {
      const ayer = toISODate(addDays(new Date(), -1))
      return movements.filter((m) => m.date === ayer)
    }
    if (tab === 'anteayer') {
      const anteayer = toISODate(addDays(new Date(), -2))
      return movements.filter((m) => m.date === anteayer)
    }

    // Weekday tab: the matching day inside the anchored week.
    const target = addDays(startOfWeek(anchor), tab as number)
    return inScope.filter(
      (m) => fromISODate(m.date).getTime() === target.getTime(),
    )
  }, [movements, scope, tab, anchor, today])

  const visibleNet = useMemo(
    () =>
      visible.reduce(
        (sum, m) => sum + (m.kind === 'ingreso' ? m.amount : -m.amount),
        0,
      ),
    [visible],
  )

  const activeTargetDate = useMemo(() => {
    if (tab === 'ayer') return toISODate(addDays(new Date(), -1))
    if (tab === 'anteayer') return toISODate(addDays(new Date(), -2))
    if (typeof tab === 'number') {
      const target = addDays(startOfWeek(anchor), tab)
      return toISODate(target)
    }
    return todayISO()
  }, [tab, anchor])

  /* ------------------------------------------------------------ actions -- */

  const handleScopeChange = useCallback((next: Scope) => {
    setScope(next)
    setAnchor(new Date())
    // Week scope opens on today's weekday; month scope opens on the whole month.
    setTab(next === 'semana' ? weekdayIndex(new Date()) : 'periodo')
  }, [])

  const handleSubmit = useCallback(
    async (text: string) => {
      setBusy(true)
      setNote(null)
      try {
        const result = await parseMessage(text, settings, activeTargetDate)

        if (result.movements.length === 0) {
          setNote({ text: result.reply, tone: 'error' })
          return
        }

        const created: Movement[] = result.movements.map((m, i) => ({
          ...m,
          id: newId(),
          createdAt: Date.now() + i, // keeps stable ordering within one batch
        }))

        setMovements((prev) => {
          const next = [...prev, ...created]
          if (user) void syncMovementsToCloud(user.id, created)
          return next
        })

        // Show the entries where they landed, if they landed outside the view.
        const first = created[0]
        if (!isSameMonth(first.date, anchor) || (scope === 'semana' && !isInWeekOf(first.date, anchor))) {
          setAnchor(fromISODate(first.date))
        }

        const summary = created
          .map((m) => `${m.kind === 'ingreso' ? '+' : '−'}${formatMoney(m.amount, currencySymbol, settings.locale).replace('−', '')}`)
          .join('  ')

        setNote({
          text: result.warning
            ? `${result.warning} ${summary}`
            : `${result.reply} ${summary}`,
          tone: result.warning ? 'error' : 'ok',
        })
      } catch (error) {
        setNote({
          text: error instanceof Error ? error.message : 'Algo falló al anotar.',
          tone: 'error',
        })
      } finally {
        setBusy(false)
      }
    },
    [settings, anchor, scope, user],
  )

  const handleDelete = useCallback((id: string) => {
    setMovements((prev) => prev.filter((m) => m.id !== id))
    if (user) void deleteRemoteMovement(user.id, id)
  }, [user])

  const handleUpdateCategory = useCallback((id: string, category: string) => {
    setMovements((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, category } : m))
      saveMovements(next)
      if (user) {
        const updated = next.find((m) => m.id === id)
        if (updated) void syncMovementsToCloud(user.id, [updated])
      }
      return next
    })
  }, [user])

  const handleUpdateMovement = useCallback(
    (id: string, patch: Partial<Omit<Movement, 'id' | 'createdAt'>>) => {
      setMovements((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
        saveMovements(next)
        if (user) {
          const updated = next.find((m) => m.id === id)
          if (updated) void syncMovementsToCloud(user.id, [updated])
        }
        return next
      })
    },
    [user],
  )

  const handleAddMovement = useCallback(
    (movement: Omit<Movement, 'id' | 'createdAt'>) => {
      const created: Movement = {
        ...movement,
        id: newId(),
        createdAt: Date.now(),
      }
      setMovements((prev) => {
        const next = [...prev, created]
        saveMovements(next)
        if (user) void syncMovementsToCloud(user.id, [created])
        return next
      })
    },
    [user],
  )

  const handleImportMovements = useCallback((imported: Movement[]) => {
    setMovements(imported)
    if (user) void syncMovementsToCloud(user.id, imported)
  }, [user])

  const handleClearMovements = useCallback(() => {
    setMovements([])
    if (user) void clearRemoteMovements(user.id)
  }, [user])

  // Clear the confirmation line after a beat so it doesn't linger as chrome.
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), note.tone === 'error' ? 7000 : 4500)
    return () => clearTimeout(t)
  }, [note])

  const groupByDay = tab === 'periodo'

  // Respects the "show symbol" toggle — pass '' to hide it everywhere
  const currencySymbol = settings.showCurrency ? settings.currency : ''

  const listRef = useRef<HTMLElement>(null)

  // Reset list scroll position to top when changing month/tab/scope
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [anchor, tab, scope])

  /* --------------------------------------------------------------- view -- */

  return (
    <div className="desktop-root">
      <div
        className="app desktop-sidebar"
        style={{ '--chat-h': `${chatHeight}px` } as React.CSSProperties}
      >
        <header className="header">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSheetOpen(true)}
            aria-label="Abrir ajustes"
          >
            <MenuIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            style={{ marginInlineStart: 'auto' }}
            onClick={() => setHistoryOpen(true)}
            aria-label="Abrir historial"
          >
            <HistoryIcon />
          </button>
        </header>

        <BalanceCard
          balance={balance}
          todayCount={todayCount}
          currency={currencySymbol}
          locale={settings.locale}
        />

        <RangeNav
          scope={scope}
          tab={tab}
          anchor={anchor}
          onScopeChange={handleScopeChange}
          onTabChange={setTab}
          onAnchorChange={setAnchor}
          selectedNet={visibleNet}
          currency={currencySymbol}
          locale={settings.locale}
        />

        {tab !== 'hoy' && tab !== 'ayer' && tab !== 'anteayer' && (
          <div className="summary">
            <span className="summary__period">{monthLabel(anchor)}</span>
          </div>
        )}

        <main className="list" ref={listRef}>
          <MovementList
            movements={visible}
            groupByDay={groupByDay}
            currency={currencySymbol}
            locale={settings.locale}
            onDelete={handleDelete}
            onUpdateCategory={handleUpdateCategory}
          />
        </main>

        <ChatBar
          busy={busy}
          note={note}
          onSubmit={(t) => void handleSubmit(t)}
          onHeightChange={setChatHeight}
        />

        {sheetOpen && (
          <SettingsSheet
            settings={settings}
            movements={movements}
            user={user}
            onSignInWithGoogle={() => signInWithGoogle(settings)}
            onSignOut={() => signOut(settings)}
            onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
            onImport={handleImportMovements}
            onClear={handleClearMovements}
            onClose={() => setSheetOpen(false)}
          />
        )}

        {historyOpen && (
          <HistoryPage
            movements={movements}
            currency={currencySymbol}
            locale={settings.locale}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </div>

      <main className="desktop-main">
        <DesktopDashboard
          movements={movements}
          anchor={anchor}
          currency={currencySymbol}
          locale={settings.locale}
          onUpdateCategory={handleUpdateCategory}
          onUpdateMovement={handleUpdateMovement}
          onDeleteMovement={handleDelete}
          onAddMovement={handleAddMovement}
        />
      </main>
    </div>
  )
}
