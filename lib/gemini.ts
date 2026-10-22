const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite']

const OUTPUT_RULES =
    'Respond with exactly ONE caption and nothing else. No list of options, no markdown, ' +
    'no asterisks, no preamble like "Here is a caption:", and no quotes around it. ' +
    'Output only the plain caption text, one or two short lines.'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Downloads an image from a public URL and asks Gemini for one caption. */
export async function captionImage(imageUrl: string, prompt: string): Promise<string> {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('GEMINI_API_KEY is not set for this app.')

    const img = await fetch(imageUrl)
    if (!img.ok) throw new Error(`Couldn't download the image (${img.status}).`)
    const mime = img.headers.get('content-type')?.split(';')[0] ?? ''
    if (!mime.startsWith('image/')) throw new Error("That URL doesn't point to an image.")
    const bytes = Buffer.from(await img.arrayBuffer())
    if (bytes.length > 5 * 1024 * 1024) throw new Error('Image is larger than 5 MB.')

    const body = JSON.stringify({
        contents: [
            {
                parts: [
                    { text: `${prompt}\n\n${OUTPUT_RULES}` },
                    { inline_data: { mime_type: mime, data: bytes.toString('base64') } },
                ],
            },
        ],
    })

    let lastError = 'Gemini did not respond.'
    let wasBusy = false
    for (const model of MODELS) {
        for (let attempt = 0; attempt < 3; attempt++) {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body }
            )
            const data = await res.json().catch(() => ({}))
            if (res.ok) {
                const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text
                const clean = text?.trim().replace(/^["“”*]+|["“”*]+$/g, '').trim()
                if (clean) return clean
                lastError = 'Gemini returned an empty caption.'
                break
            }
            const msg = data.error?.message ?? `Gemini error ${res.status}`
            console.error(`[gemini] ${model} attempt ${attempt + 1} (${res.status}):`, msg)
            if (res.status === 429 || res.status === 503) {
                wasBusy = true
                await sleep(1000 * 2 ** attempt)
                continue
            }
            // Don't let a missing/unsupported backup model hide the real problem
            if (!(res.status === 404 && wasBusy)) lastError = msg
            break
        }
    }
    throw new Error(wasBusy ? 'Gemini is busy right now. Try again in a few seconds.' : lastError)
}