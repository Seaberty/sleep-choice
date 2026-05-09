-- Multi-platform brand intelligence (Serper + LLM pipeline → frontend / intelligence center)
-- Apply in Supabase SQL editor or via CLI: supabase db push

create table if not exists public.brand_intelligence (
    id uuid primary key default gen_random_uuid(),
    brand_slug text not null,
    product_slug text not null,
    source_platform text not null,
    sentiment_score double precision not null default 0.5
        check (sentiment_score >= 0 and sentiment_score <= 1),
    key_issue_tags text[] not null default '{}',
    verdict_summary text not null default '',
    signal_density integer not null default 0 check (signal_density >= 0),
    confidence_score double precision not null default 0
        check (confidence_score >= 0 and confidence_score <= 1),
    collected_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint brand_intelligence_platform_unique unique (brand_slug, product_slug, source_platform)
);

create index if not exists brand_intelligence_product_slug_idx
    on public.brand_intelligence (product_slug);

create index if not exists brand_intelligence_brand_slug_idx
    on public.brand_intelligence (brand_slug);

comment on table public.brand_intelligence is 'Aggregated review/social signals per platform (Reddit, Amazon, Trustpilot, SleepLine, …).';

comment on column public.brand_intelligence.source_platform is 'Human-readable platform label, e.g. Reddit, Amazon, Trustpilot, SleepLine.';
comment on column public.brand_intelligence.sentiment_score is 'AI-estimated polarity 0.0 (negative) .. 1.0 (positive).';
comment on column public.brand_intelligence.key_issue_tags is 'Extracted issue/theme labels from snippets.';
comment on column public.brand_intelligence.verdict_summary is 'Batch summary for transparency UI (also usable beside audit_note).';
comment on column public.brand_intelligence.signal_density is 'Sample count (organic SERP rows) for this platform query.';
comment on column public.brand_intelligence.confidence_score is 'Higher when signal_density is larger (never substitute for clinical audit).';

alter table public.brand_intelligence enable row level security;

-- Public read for site intelligence center (writes use service role / bypass RLS)
create policy "brand_intelligence_select_public"
    on public.brand_intelligence
    for select
    to anon, authenticated
    using (true);
