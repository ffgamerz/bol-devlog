import { useEffect, useRef, useState } from 'react'
import { Film } from 'lucide-react'
import { cn } from '@/lib/cn'
import { apiFetch } from '@/data/api'

/**
 * 9:16 portrait thumbnail from /api/thumb/:id (Drive .mp4 frame -> YouTube -> none).
 * box 36x64, list 45x80, large = up to 180x320. Lazy (loads when scrolled into view), skeleton then 150ms fade.
 * No image: same-size empty frame with a film glyph so nothing jumps. Desktop hover shows a 180x320 preview.
 */
type Size = 'box' | 'list' | 'large'
const SIZE: Record<Size, string> = { box: 'w-9 h-16', list: 'w-[45px] h-20', large: 'w-[180px] h-80 mx-auto' }
/** Bump to bust browser-cached responses (v1 cached 404s for 1h before no-image became 204). */
export const THUMB_V = 4
const cache = new Map<string, Promise<string | null>>()
const bust = new Map<string, number>()
/** After a new thumbnail is saved: drop cached results (incl. a cached miss) so every card refetches it. */
export function forgetThumb(videoId: string) { for (const k of [...cache.keys()]) if (k.startsWith(videoId)) cache.delete(k); bust.set(videoId, Date.now()); window.dispatchEvent(new CustomEvent('bol-thumb', { detail: videoId })) }
export function thumbUrl(videoId: string, big = false, ytFirst = false): Promise<string | null> {
  const k = `${videoId}${big ? ':lg' : ''}${ytFirst ? ':yt' : ''}`
  let p = cache.get(k)
  if (!p) {
    p = apiFetch(`/api/thumb/${videoId}?v=${THUMB_V}${big ? '&s=lg' : ''}${ytFirst ? '&src=yt' : ''}${bust.has(videoId) ? `&b=${bust.get(videoId)}` : ''}`).then(async (r) => (r.status === 200 ? URL.createObjectURL(await r.blob()) : null), () => null)
    p.then((u) => { if (!u) window.setTimeout(() => cache.delete(k), 300_000) })   // miss cached 5 min
    cache.set(k, p)
  }
  return p
}
/** True when the server might have an image (Drive .mp4 or YouTube link). */
export const mayHaveThumb = (v: { drive_file_id?: string | null; drive_folder_id?: string | null; has_file?: boolean; has_drive?: boolean; youtube_url?: string | null }) => !!(v.has_file || v.has_drive || v.drive_file_id || v.drive_folder_id || v.youtube_url)

export function Thumb(p: { videoId?: string | null; hasImage?: boolean; alt?: string; size?: Size; large?: boolean; className?: string; preview?: boolean }) {
  return <ThumbInner key={`${p.videoId ?? ''}:${p.hasImage ? 1 : 0}`} {...p} />
}
function ThumbInner({ videoId, hasImage, alt = '', size, large, className, preview = true }: { videoId?: string | null; hasImage?: boolean; alt?: string; size?: Size; large?: boolean; className?: string; preview?: boolean }) {
  const sz: Size = size ?? (large ? 'large' : 'list')
  const want = !!videoId && !!hasImage
  const el = useRef<HTMLDivElement | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'none'>(want ? 'loading' : 'none')
  const [hover, setHover] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!want || !el.current) return
    let live = true
    const go = () => thumbUrl(videoId!, sz === 'large').then((u) => { if (!live) return; if (u) setSrc(u); else setState('none') })
    if (typeof IntersectionObserver === 'undefined') { go(); return () => { live = false } }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go() } }, { rootMargin: '200px' })
    io.observe(el.current)
    return () => { live = false; io.disconnect() }
  }, [want, videoId, sz])
  // A new thumbnail was saved for this video (forgetThumb): refetch and swap it in without a page reload.
  useEffect(() => {
    if (!want || !videoId) return
    let live = true
    const on = (e: Event) => {
      if ((e as CustomEvent).detail !== videoId) return
      thumbUrl(videoId, sz === 'large').then((u) => { if (live && u) setSrc(u) })
    }
    window.addEventListener('bol-thumb', on)
    return () => { live = false; window.removeEventListener('bol-thumb', on) }
  }, [want, videoId, sz])
  const canPreview = preview && sz !== 'large' && state === 'ok' && typeof matchMedia !== 'undefined' && matchMedia('(hover: hover)').matches
  return (
    <div ref={el} data-thumb={state} className={cn('relative shrink-0 overflow-hidden rounded-[6px] bg-surface-3', SIZE[sz], className)}
      onMouseEnter={() => canPreview && el.current && setHover(el.current.getBoundingClientRect())} onMouseLeave={() => setHover(null)}>
      {src && state !== 'none' && (
        <img src={src} alt={alt} decoding="async" onLoad={() => setState('ok')} onError={() => setState('none')}
          className={cn('size-full object-cover transition-opacity duration-150 ease-out', state === 'ok' ? 'opacity-100' : 'opacity-0')} />
      )}
      {state === 'loading' && <div aria-hidden className="absolute inset-0 animate-pulse bg-surface-3" />}
      {state === 'none' && <div className="absolute inset-0 grid place-items-center border border-dashed border-border text-faint" role="img" aria-label="No thumbnail"><Film aria-hidden className={sz === 'large' ? 'size-10' : 'size-4'} /></div>}
      {hover && videoId && <Preview id={videoId} r={hover} alt={alt} />}
    </div>
  )
}
function Preview({ id, r, alt }: { id: string; r: DOMRect; alt: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => { let live = true; thumbUrl(id, true).then((u) => live && setSrc(u)); return () => { live = false } }, [id])
  const left = r.right + 196 < window.innerWidth ? r.right + 8 : Math.max(8, r.left - 188)
  const top = Math.min(Math.max(8, r.top + r.height / 2 - 160), window.innerHeight - 328)
  return (
    <div role="tooltip" className="pointer-events-none fixed z-50 h-80 w-[180px] overflow-hidden rounded-lg border border-border bg-surface-3 shadow-xl msg-in" style={{ left, top }}>
      {src && <img src={src} alt={alt} className="size-full object-cover" />}
    </div>
  )
}
