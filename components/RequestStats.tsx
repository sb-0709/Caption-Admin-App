import { createClient } from '@/lib/supabase/server'
import { fetchAll, fmtNum } from '@/lib/format'

type Req = { status: string; latency_ms: number | null; created_at: string; source: string }
type Res = { input_tokens: number | null; output_tokens: number | null }

/** Health summary shown above the generation-requests log. */
export default async function RequestStats() {
    const supabase = await createClient()
    const [reqs, resps] = await Promise.all([
        fetchAll<Req>((a, b) =>
            supabase.from('generation_requests').select('status, latency_ms, created_at, source').range(a, b)
        ),
        fetchAll<Res>((a, b) => supabase.from('llm_responses').select('input_tokens, output_tokens').range(a, b)),
    ])

    const live = reqs.filter((r) => r.source !== 'backfill')
    const ok = live.filter((r) => r.status === 'success').length
    const errors = live.filter((r) => r.status === 'error').length
    const finished = ok + errors
    const lat = live.map((r) => r.latency_ms).filter((n): n is number => typeof n === 'number').sort((a, b) => a - b)
    const avg = lat.length ? Math.round(lat.reduce((s, n) => s + n, 0) / lat.length) : null
    const p95 = lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] : null
    const tokens = resps.reduce((s, r) => s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0)
    const weekAgo = Date.now() - 7 * 86_400_000
    const last7 = reqs.filter((r) => new Date(r.created_at).getTime() >= weekAgo).length

    return (
        <section className="kpis kpis-4">
            <div className="kpi">
                <span className="kpi-label">Requests</span>
                <span className="kpi-num">{fmtNum(reqs.length)}</span>
                <span className="kpi-note">{last7} in the last 7 days</span>
            </div>
            <div className="kpi">
                <span className="kpi-label">Success rate</span>
                <span className="kpi-num">
          {finished ? Math.round((ok / finished) * 100) : '—'}
                    {finished ? <small>%</small> : null}
        </span>
                <span className="kpi-note">
          {errors} error{errors === 1 ? '' : 's'} (live requests)
        </span>
            </div>
            <div className="kpi">
                <span className="kpi-label">Latency</span>
                <span className="kpi-num">
          {avg !== null ? (avg / 1000).toFixed(1) : '—'}
                    {avg !== null ? <small>s</small> : null}
        </span>
                <span className="kpi-note">avg · p95 {p95 !== null ? (p95 / 1000).toFixed(1) + 's' : '—'}</span>
            </div>
            <div className="kpi">
                <span className="kpi-label">Tokens used</span>
                <span className="kpi-num">{fmtNum(tokens)}</span>
                <span className="kpi-note">input + output</span>
            </div>
        </section>
    )
}