/** Placeholders the description generator leaves where the product link goes (both = the video's shopee_product_url). */
const PLACEHOLDER = 'xxxlink(?:shopee|here)xxx'

export const SHOPEE_LINK_MISSING = 'This video has no Shopee product link yet, so nothing was copied'

export const hasShopeePlaceholder = (text: string | null | undefined) => !!text && new RegExp(PLACEHOLDER, 'i').test(text)

/** Replaces every placeholder (any case) with the product link. No link, or no placeholder: the text is returned as is. */
export function fillShopeeLink(text: string, url: string | null | undefined): string {
  const link = url?.trim()
  return link ? text.replace(new RegExp(PLACEHOLDER, 'gi'), () => link) : text
}

/** Text ready for the clipboard, or null when it still holds a placeholder and the video has no product link. */
export function textForCopy(text: string, url: string | null | undefined): string | null {
  if (!url?.trim() && hasShopeePlaceholder(text)) return null
  return fillShopeeLink(text, url)
}

/** Clipboard copy for captions: fills the product link, or toasts SHOPEE_LINK_MISSING and copies nothing. */
export async function copyCaption(text: string, url: string | null | undefined, what: string, toast: (m: string, kind?: 'error' | 'info' | 'success' | 'warning') => void) {
  const t = textForCopy(text, url)
  if (t === null) return toast(SHOPEE_LINK_MISSING, 'error')
  try { await navigator.clipboard.writeText(t); toast(`${what} copied`) } catch { toast('Copy failed', 'error') }
}
