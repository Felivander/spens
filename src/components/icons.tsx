/**
 * Icon set: Iconoir (MIT). One library, one 24px grid, one stroke language.
 *
 * These are thin wrappers rather than direct imports so the whole app shares a
 * single place to set size and stroke weight. Every icon inherits
 * `currentColor`, so hover / selected / disabled states come from CSS — there
 * is never a second asset for a second state.
 *
 * Stroke weight follows the optical weight of the text beside it:
 * 1.5 next to regular copy, 2 next to bold labels and small glyphs.
 */
import {
  ArrowUp,
  Check,
  Circle,
  List,
  NavArrowDown,
  NavArrowLeft,
  NavArrowRight,
  Refresh,
  Trash,
  Xmark,
} from 'iconoir-react'

interface IconProps {
  size?: number
  strokeWidth?: number
}

/**
 * The menu trigger is a plain circle — a Braun dial rather than a hamburger,
 * and the same geometry as the dot row below it. Stroke is 2 so a lone ring
 * at this size doesn't read as a hairline.
 */
export function MenuIcon({ size = 20, strokeWidth = 2 }: IconProps) {
  return <Circle width={size} height={size} strokeWidth={strokeWidth} aria-hidden="true" />
}

export function ChevronDownPlain({ size = 18, strokeWidth = 2 }: IconProps) {
  return (
    <NavArrowDown width={size} height={size} strokeWidth={strokeWidth} aria-hidden="true" />
  )
}

export function ChevronLeft({ size = 20, strokeWidth = 2 }: IconProps) {
  return (
    <NavArrowLeft width={size} height={size} strokeWidth={strokeWidth} aria-hidden="true" />
  )
}

export function ChevronRight({ size = 20, strokeWidth = 2 }: IconProps) {
  return (
    <NavArrowRight width={size} height={size} strokeWidth={strokeWidth} aria-hidden="true" />
  )
}

export function CheckIcon({ size = 18, strokeWidth = 2 }: IconProps) {
  return (
    <Check
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      className="menu__check"
      aria-hidden="true"
    />
  )
}

export function ArrowUpIcon({ size = 20, strokeWidth = 2 }: IconProps) {
  return <ArrowUp width={size} height={size} strokeWidth={strokeWidth} aria-hidden="true" />
}

export function SpinnerIcon({ size = 20, strokeWidth = 2 }: IconProps) {
  return (
    <Refresh
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      className="spinner"
      aria-hidden="true"
    />
  )
}

export function CloseIcon({ size = 22, strokeWidth = 1.5 }: IconProps) {
  return <Xmark width={size} height={size} strokeWidth={strokeWidth} aria-hidden="true" />
}

export function HistoryIcon({ size = 20, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="3.5" />
    </svg>
  )
}

export function ListIcon({ size = 18, strokeWidth = 1.5 }: IconProps) {
  return <List width={size} height={size} strokeWidth={strokeWidth} aria-hidden="true" />
}

export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"
      />
      <path
        fill="#34A853"
        d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
      />
    </svg>
  )
}

export function TrashIcon({ size = 18, strokeWidth = 1.5 }: IconProps) {
  return <Trash width={size} height={size} strokeWidth={strokeWidth} aria-hidden="true" />
}

