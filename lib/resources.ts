// One config drives the list, detail, create/edit form and server actions
// for every table below. To add a table: add an entry here.

export type FieldType =
    | 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'ref' | 'email' | 'url' | 'image' | 'datetime'

export type Field = {
    name: string
    label: string
    type: FieldType
    required?: boolean
    options?: string[]                         // for 'select'
    ref?: { table: string; label: string[] }   // for 'ref' (foreign key)
    list?: boolean                             // show as a column in the table
    editable?: boolean                         // false = shown but never written (default true)
    help?: string
    lowercase?: boolean
    step?: string                              // for 'number'
}

export type Resource = {
    key: string            // URL slug: /data/<key>
    table: string
    title: string
    singular: string
    group: string
    description: string
    ops: { create: boolean; update: boolean; delete: boolean }
    fields: Field[]
    order: { column: string; ascending: boolean }
    search?: string[]      // text columns for the search box
    children?: { resource: string; fk: string; title: string }[]
}

const created: Field = { name: 'created_at', label: 'Created', type: 'datetime', list: true, editable: false }
const profileRef = { table: 'profiles', label: ['first_name', 'last_name'] }

export const RESOURCES: Resource[] = [
    // ---------------- Prompts ----------------
    {
        key: 'prompt-chains',
        table: 'prompt_chains',
        title: 'Prompt chains',
        singular: 'prompt chain',
        group: 'Prompts',
        description: 'Ordered sequences of LLM calls used to generate a caption.',
        ops: { create: false, update: false, delete: false },
        fields: [
            { name: 'name', label: 'Name', type: 'text', list: true },
            { name: 'description', label: 'Description', type: 'textarea', list: true },
            { name: 'is_active', label: 'Active', type: 'boolean', list: true },
            created,
        ],
        order: { column: 'id', ascending: true },
        search: ['name', 'description'],
        children: [
            { resource: 'chain-steps', fk: 'chain_id', title: 'Steps' },
            { resource: 'chain-mix', fk: 'chain_id', title: 'Mix weight' },
            { resource: 'generation-requests', fk: 'chain_id', title: 'Recent requests' },
        ],
    },
    {
        key: 'chain-steps',
        table: 'prompt_chain_steps',
        title: 'Prompt chain steps',
        singular: 'step',
        group: 'Prompts',
        description: 'Each step of a chain: which model it calls and with what prompt.',
        ops: { create: false, update: false, delete: false },
        fields: [
            { name: 'chain_id', label: 'Chain', type: 'ref', ref: { table: 'prompt_chains', label: ['name'] }, list: true },
            { name: 'step_order', label: 'Step', type: 'number', list: true },
            { name: 'name', label: 'Name', type: 'text', list: true },
            { name: 'model_id', label: 'Model', type: 'ref', ref: { table: 'llm_models', label: ['name'] }, list: true },
            { name: 'temperature', label: 'Temperature', type: 'number', list: true },
            { name: 'system_prompt', label: 'System prompt', type: 'textarea' },
            { name: 'user_prompt_template', label: 'User prompt template', type: 'textarea' },
            created,
        ],
        order: { column: 'chain_id', ascending: true },
        search: ['name', 'user_prompt_template'],
    },
    {
        key: 'chain-mix',
        table: 'prompt_chain_mix',
        title: 'Prompt chain mix',
        singular: 'mix entry',
        group: 'Prompts',
        description: 'How often each chain is picked. Weights are relative (e.g. 70 / 30).',
        ops: { create: false, update: true, delete: false },
        fields: [
            { name: 'chain_id', label: 'Chain', type: 'ref', ref: { table: 'prompt_chains', label: ['name'] }, list: true, editable: false },
            { name: 'weight', label: 'Weight (0–100)', type: 'number', required: true, list: true, step: '1' },
            { name: 'is_active', label: 'Active', type: 'boolean', list: true },
            { name: 'updated_at', label: 'Updated', type: 'datetime', list: true, editable: false },
        ],
        order: { column: 'weight', ascending: false },
    },
    {
        key: 'terms',
        table: 'terms',
        title: 'Terms',
        singular: 'term',
        group: 'Prompts',
        description: 'Words the AI might not know (campus places, slang, acronyms). Sent to Gemini with every caption request.',
        ops: { create: true, update: true, delete: true },
        fields: [
            { name: 'term', label: 'Term', type: 'text', required: true, list: true, help: 'e.g. John Jay' },
            { name: 'definition', label: 'Meaning', type: 'textarea', required: true, list: true, help: 'Explain it the way you would to someone new' },
            { name: 'example', label: 'Used in a sentence', type: 'textarea', list: true },
            created,
        ],
        order: { column: 'term', ascending: true },
        search: ['term', 'definition'],
    },
    {
        key: 'examples',
        table: 'ai_generation_examples',
        title: 'AI generation examples',
        singular: 'example',
        group: 'Prompts',
        description: 'Examples of good AI output. Active ones are shown to Gemini as style references.',
        ops: { create: true, update: true, delete: true },
        fields: [
            { name: 'image_url', label: 'Image', type: 'image', list: true },
            { name: 'prompt', label: 'Prompt', type: 'textarea', required: true, list: true },
            { name: 'caption', label: 'Caption', type: 'textarea', required: true, list: true },
            { name: 'notes', label: 'Notes', type: 'textarea' },
            { name: 'is_active', label: 'Active', type: 'boolean', list: true },
            created,
        ],
        order: { column: 'created_at', ascending: false },
        search: ['prompt', 'caption'],
    },

    // ---------------- Models ----------------
    {
        key: 'providers',
        table: 'llm_providers',
        title: 'LLM providers',
        singular: 'provider',
        group: 'Models',
        description: 'Companies whose APIs we call. Store the env var NAME, never the key itself.',
        ops: { create: true, update: true, delete: true },
        fields: [
            { name: 'name', label: 'Name', type: 'text', required: true, list: true },
            { name: 'base_url', label: 'Base URL', type: 'url', list: true },
            { name: 'api_key_env', label: 'API key env var', type: 'text', list: true, help: 'e.g. GEMINI_API_KEY' },
            { name: 'is_active', label: 'Active', type: 'boolean', list: true },
            created,
        ],
        order: { column: 'name', ascending: true },
        search: ['name'],
        children: [{ resource: 'models', fk: 'provider_id', title: 'Models' }],
    },
    {
        key: 'models',
        table: 'llm_models',
        title: 'LLM models',
        singular: 'model',
        group: 'Models',
        description: 'Models available to prompt chains.',
        ops: { create: true, update: true, delete: true },
        fields: [
            { name: 'name', label: 'Name', type: 'text', required: true, list: true },
            { name: 'model_id', label: 'API model ID', type: 'text', required: true, list: true, help: 'Exact string sent to the API' },
            { name: 'provider_id', label: 'Provider', type: 'ref', ref: { table: 'llm_providers', label: ['name'] }, required: true, list: true },
            { name: 'supports_vision', label: 'Supports images', type: 'boolean', list: true },
            { name: 'input_cost_per_mtok', label: 'Input $ / 1M tokens', type: 'number', step: '0.0001' },
            { name: 'output_cost_per_mtok', label: 'Output $ / 1M tokens', type: 'number', step: '0.0001' },
            { name: 'is_active', label: 'Active', type: 'boolean', list: true },
            created,
        ],
        order: { column: 'name', ascending: true },
        search: ['name', 'model_id'],
        children: [{ resource: 'llm-responses', fk: 'model_id', title: 'Recent responses' }],
    },

    // ---------------- Logs ----------------
    {
        key: 'generation-requests',
        table: 'generation_requests',
        title: 'Generation requests',
        singular: 'request',
        group: 'Logs',
        description: 'Every time someone asked the AI for a caption.',
        ops: { create: false, update: false, delete: false },
        fields: [
            { name: 'status', label: 'Status', type: 'select', options: ['pending', 'success', 'error'], list: true },
            { name: 'source', label: 'Source', type: 'select', options: ['app', 'admin', 'backfill'], list: true },
            { name: 'user_id', label: 'User', type: 'ref', ref: profileRef, list: true },
            { name: 'image_url', label: 'Image', type: 'image', list: true },
            { name: 'prompt', label: 'Prompt', type: 'textarea', list: true },
            { name: 'model_id', label: 'Model', type: 'ref', ref: { table: 'llm_models', label: ['name'] } },
            { name: 'chain_id', label: 'Chain', type: 'ref', ref: { table: 'prompt_chains', label: ['name'] } },
            { name: 'latency_ms', label: 'Latency (ms)', type: 'number', list: true },
            { name: 'error_message', label: 'Error', type: 'textarea' },
            created,
        ],
        order: { column: 'created_at', ascending: false },
        search: ['prompt', 'error_message'],
        children: [{ resource: 'llm-responses', fk: 'request_id', title: 'LLM responses' }],
    },
    {
        key: 'llm-responses',
        table: 'llm_responses',
        title: 'LLM responses',
        singular: 'response',
        group: 'Logs',
        description: 'Raw output from each model call, with token counts.',
        ops: { create: false, update: false, delete: false },
        fields: [
            { name: 'request_id', label: 'Request', type: 'ref', ref: { table: 'generation_requests', label: ['id'] }, list: true },
            { name: 'model_id', label: 'Model', type: 'ref', ref: { table: 'llm_models', label: ['name'] }, list: true },
            { name: 'step_order', label: 'Step', type: 'number' },
            { name: 'response_text', label: 'Response', type: 'textarea', list: true },
            { name: 'input_tokens', label: 'In tokens', type: 'number', list: true },
            { name: 'output_tokens', label: 'Out tokens', type: 'number', list: true },
            { name: 'finish_reason', label: 'Finish reason', type: 'text' },
            created,
        ],
        order: { column: 'created_at', ascending: false },
        search: ['response_text'],
    },

    // ---------------- Access ----------------
    {
        key: 'signup-domains',
        table: 'allowed_signup_domains',
        title: 'Allowed signup domains',
        singular: 'domain',
        group: 'Access',
        description: 'If this list or the email whitelist has entries, only matching people can create new accounts.',
        ops: { create: true, update: true, delete: true },
        fields: [
            { name: 'domain', label: 'Domain', type: 'text', required: true, list: true, lowercase: true, help: 'e.g. columbia.edu (no @)' },
            { name: 'note', label: 'Note', type: 'text', list: true },
            created,
        ],
        order: { column: 'domain', ascending: true },
        search: ['domain', 'note'],
    },
    {
        key: 'whitelisted-emails',
        table: 'whitelisted_emails',
        title: 'Whitelisted emails',
        singular: 'email',
        group: 'Access',
        description: 'Individual addresses allowed to sign up even if their domain isn’t allowed.',
        ops: { create: true, update: true, delete: true },
        fields: [
            { name: 'email', label: 'Email', type: 'email', required: true, list: true, lowercase: true },
            { name: 'note', label: 'Note', type: 'text', list: true },
            created,
        ],
        order: { column: 'email', ascending: true },
        search: ['email', 'note'],
    },
]

export function getResource(key: string) {
    return RESOURCES.find((r) => r.key === key)
}

export function opsLabel(r: Resource) {
    const s = ['Read']
    if (r.ops.create) s.unshift('Create')
    if (r.ops.update) s.push('Update')
    if (r.ops.delete) s.push('Delete')
    return s.join(' · ')
}