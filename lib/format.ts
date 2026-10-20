type Named = { first_name?: string | null; last_name?: string | null } | null | undefined

export function displayName(p: Named) {
  return [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Anonymous'
}

export function fmtNum(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })
}

export function truncate(s: string | null | undefined, n = 80) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export function shortId(id: string) {
  return id.slice(0, 8)
}

/**
 * Supabase returns at most 1000 rows per request — page through everything.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const out: T[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < size) break
  }
  return out
}
