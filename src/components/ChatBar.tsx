import { useEffect, useRef, useState } from 'react'
import { ArrowUpIcon, SpinnerIcon } from './icons'

export interface ChatNote {
  text: string
  tone: 'ok' | 'error'
}

/** Rotating hints so the input always teaches what it understands. */
const EXAMPLES = [
  'café 1.200',
  'super 25 lucas',
  'cobré 180k',
  'nafta 40 mil ayer',
  'uber 6.500 y almuerzo 14k',
]

interface Props {
  busy: boolean
  note: ChatNote | null
  /** Optional trailing action inside the note, e.g. "Deshacer". */
  noteAction?: { label: string; run: () => void } | null
  onSubmit: (text: string) => void
  /** Reports the bar's rendered height so the list can reserve room under it. */
  onHeightChange: (height: number) => void
}

export function ChatBar({ busy, note, noteAction, onSubmit, onHeightChange }: Props) {
  const [value, setValue] = useState('')
  const [example, setExample] = useState(0)

  useEffect(() => {
    if (value) return
    const t = setInterval(() => setExample((i) => (i + 1) % EXAMPLES.length), 3500)
    return () => clearInterval(t)
  }, [value])
  const inputRef = useRef<HTMLInputElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // The bar grows and shrinks as the confirmation line comes and goes, and the
  // safe-area inset differs per device, so the height is measured rather than
  // assumed.
  useEffect(() => {
    const el = barRef.current
    if (!el) return

    const report = () => onHeightChange(el.offsetHeight)
    report()

    const observer = new ResizeObserver(report)
    observer.observe(el)
    return () => observer.disconnect()
  }, [onHeightChange])

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    const text = value.trim()
    if (!text || busy) return
    onSubmit(text)
    setValue('')
    // Keep the keyboard up on iOS so a second entry needs no extra tap.
    inputRef.current?.focus()
  }

  return (
    <div className="chat" ref={barRef}>
      {note && (
        <p
          className={`chat__note${note.tone === 'error' ? ' chat__note--error' : ''}`}
          role="status"
          aria-live="polite"
        >
          <span className="chat__note-dot" aria-hidden="true" />
          <span className="chat__note-text">{note.text}</span>
          {noteAction && (
            <button type="button" className="chat__note-action" onClick={noteAction.run}>
              {noteAction.label}
            </button>
          )}
        </p>
      )}

      <form className="chat__form" onSubmit={send}>
        <label className="sr-only" htmlFor="chat-input">
          Anotar un gasto o ingreso
        </label>
        <input
          id="chat-input"
          ref={inputRef}
          className="chat__input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={EXAMPLES[example]}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck={false}
          enterKeyHint="send"
          disabled={busy}
        />
        <button
          type="submit"
          className="chat__send"
          disabled={busy || value.trim().length === 0}
          aria-label={busy ? 'Anotando' : 'Anotar'}
        >
          {busy ? <SpinnerIcon /> : <ArrowUpIcon />}
        </button>
      </form>
    </div>
  )
}
