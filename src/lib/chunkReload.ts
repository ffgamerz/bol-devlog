import { lazy, type ComponentType } from 'react'

/** After a deploy an open tab may ask for a chunk that no longer exists. Reload once (sessionStorage guard, no loops). */
const KEY = 'bs-chunk-reload'
export function reloadOnceForChunk(err?: unknown): boolean {
  if (sessionStorage.getItem(KEY)) return false
  sessionStorage.setItem(KEY, String(Date.now()))
  console.warn('Chunk failed to load, reloading once', err)
  window.location.reload()
  return true
}
/** Clear the guard once the app has loaded fine for a while, so the next deploy can reload again. */
export function armChunkReload() {
  window.addEventListener('vite:preloadError', (e) => { if (reloadOnceForChunk((e as Event & { payload?: unknown }).payload)) e.preventDefault() })
  window.setTimeout(() => sessionStorage.removeItem(KEY), 10_000)
}
const isChunkErr = (e: unknown) => /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically|MIME type|ChunkLoadError/i.test(String((e as Error)?.message ?? e))
/** lazy() that retries once, then reloads the page once, if the chunk is gone. */
export function lazyRetry<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return lazy(async () => {
    try { return await load() } catch (e) {
      if (!isChunkErr(e)) throw e
      try { return await load() } catch (e2) { if (reloadOnceForChunk(e2)) return new Promise<never>(() => {}); throw e2 }
    }
  })
}
