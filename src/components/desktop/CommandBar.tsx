import { forwardRef, useState } from 'react'
import type { ChatNote } from '../ChatBar'
import { ArrowUpIcon, CloseIcon, SpinnerIcon } from '../icons'

interface Props {
  busy: boolean
  note: ChatNote | null
  /** Shown as a chip when entries will land on a day other than today. */
  targetLabel: string | null
  onClearTarget: () => void
  onSubmit: (text: string) => void
  /** Optional trailing action inside the note (e.g. "Deshacer"). */
  noteAction?: { label: string; run: () => void } | null
}

/**
 * Desktop entry point: the same natural-language parser as the phone's chat
 * bar, living in the top bar. `/` or Ctrl+K focuses it from anywhere.
 */
export const CommandBar = forwardRef<HTMLInputElement, Props>(function CommandBar(
  { busy, note, targetLabel, onClearTarget, onSubmit, noteAction },
  ref,
) {
  const [value, setValue] = useState('')

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    const text = value.trim()
    if (!text || busy) return
    onSubmit(text)
    setValue('')
  }

  return (
    <div className="dk-cmd">
      <form className="dk-cmd__form" onSubmit={send}>
        {targetLabel && (
          <span className="dk-cmd__target">
            {targetLabel}
            <button
              type="button"
              className="dk-cmd__target-x"
              onClick={onClearTarget}
              aria-label="Anotar para hoy"
              title="Volver a hoy"
            >
              <CloseIcon size={12} strokeWidth={2} />
            </button>
          </span>
        )}
        <label className="sr-only" htmlFor="dk-cmd-input">
          Anotar un gasto o ingreso
        </label>
        <input
          id="dk-cmd-input"
          ref={ref}
          className="dk-cmd__input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              if (value) setValue('')
              else e.currentTarget.blur()
            }
          }}
          placeholder="café 1.200 · cobré 180k · super 25 lucas ayer"
          autoComplete="off"
          spellCheck={false}
          readOnly={busy}
        />
        {!value && !busy && <kbd className="dk-kbd">/</kbd>}
        <button
          type="submit"
          className="dk-cmd__send"
          disabled={busy || value.trim().length === 0}
          aria-label={busy ? 'Anotando' : 'Anotar'}
        >
          {busy ? <SpinnerIcon size={16} /> : <ArrowUpIcon size={16} />}
        </button>
      </form>

      {note && (
        <p
          className={`dk-cmd__note${note.tone === 'error' ? ' dk-cmd__note--error' : ''}`}
          role="status"
          aria-live="polite"
        >
          <span className="dk-cmd__note-text">{note.text}</span>
          {noteAction && (
            <button type="button" className="dk-cmd__note-action" onClick={noteAction.run}>
              {noteAction.label}
            </button>
          )}
        </p>
      )}
    </div>
  )
})
