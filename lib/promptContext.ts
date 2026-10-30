import type { SupabaseClient } from '@supabase/supabase-js'

export async function buildPromptContext(supabase: SupabaseClient): Promise<string> {
    const [{ data: terms }, { data: examples }] = await Promise.all([
        supabase.from('terms').select('term, definition').order('term').limit(50),
        supabase
            .from('ai_generation_examples')
            .select('caption')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(5),
    ])

    const parts: string[] = []
    if (terms?.length) {
        parts.push(
            'Glossary (use these meanings if any of these words are relevant to the image):\n' +
            terms.map((t) => `- ${t.term}: ${t.definition}`).join('\n')
        )
    }
    if (examples?.length) {
        parts.push(
            'Examples of the style of caption we like (do not copy them):\n' +
            examples.map((e) => `- ${e.caption}`).join('\n')
        )
    }
    return parts.join('\n\n')
}