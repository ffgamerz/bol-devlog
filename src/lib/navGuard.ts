/**
 * One app-wide "unsaved changes" guard. A screen with unsaved edits registers a function that
 * resolves true when it's OK to leave (saved or discarded) and false to stay (keep editing).
 * The shell consults it before route changes; the browser's own prompt covers tab close/refresh.
 */
type Guard = { dirty: () => boolean; leave: () => Promise<boolean> }
let current: Guard | null = null

export function setNavGuard(g: Guard | null) { current = g }
export const isGuarded = () => !!current?.dirty()
/** Resolves true when navigation may continue. */
export async function runNavGuard(): Promise<boolean> {
  if (!current || !current.dirty()) return true
  return current.leave()
}

/** Native prompt on tab close / refresh while there are unsaved edits (the only option browsers allow). */
export function beforeUnload(e: BeforeUnloadEvent) {
  if (!isGuarded()) return
  e.preventDefault()
  e.returnValue = ''
}

/**
 * Browser Back/Forward. BrowserRouter has no blocker, so we listen to popstate *before* the
 * router (registered at import time, earlier than the router's own listener) and, while there
 * are unsaved edits, stop the event, put the URL back, and ask. If leaving is OK we replay the
 * history move so the router sees it.
 */
let lastHref = typeof location !== 'undefined' ? location.href : ''
let lastIdx: number | null = null
let swallow = 0     // our own history.go() restore: hide it from the router
let restored: (() => void) | null = null
let replaying = false
const idxOf = (st: unknown): number | null => { const i = (st as { idx?: unknown } | null)?.idx; return typeof i === 'number' ? i : null }
/** Call after every committed location change (AppShell does this on each route render). */
export function rememberLocation() { lastHref = location.href; lastIdx = idxOf(history.state) }
/**
 * React Router stores a position index in history.state.idx, so we know how far the user moved
 * (delta) and can undo it with history.go(-delta): no new entries, Forward history kept.
 * Older entries without an index fall back to replaceState (still adds nothing).
 */
export function onPopState(e: PopStateEvent) {
  if (swallow) { swallow--; e.stopImmediatePropagation(); restored?.(); restored = null; return }
  if (replaying) { replaying = false; return }
  if (!isGuarded()) return
  e.stopImmediatePropagation()
  const now = idxOf(history.state)
  const delta = now != null && lastIdx != null ? now - lastIdx : null
  const target = location.href, targetState = history.state
  // Ask only once the restore has landed, so a quick answer can't race our own go().
  const back = delta
    ? new Promise<void>((res) => { restored = res; swallow++; history.go(-delta) })
    : (history.replaceState(history.state, '', lastHref), Promise.resolve())
  back.then(runNavGuard).then((ok) => {
    if (!ok) return
    if (delta) { replaying = true; history.go(delta) }
    else { history.replaceState(targetState, '', target); replaying = true; window.dispatchEvent(new PopStateEvent('popstate', { state: targetState })) }
  })
}
if (typeof window !== 'undefined') window.addEventListener('popstate', onPopState)
