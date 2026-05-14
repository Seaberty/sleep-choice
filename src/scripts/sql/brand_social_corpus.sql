-- brand_social_corpus：按 URL 去重的「原始片段」多行表（Reddit/Brave 等写入）。
-- brand_intelligence：按 (brand_slug, product_slug, source_platform) 聚合的一行情报表。
-- 二者用途不同；不要把 corpus 字段硬塞进 brand_intelligence。
--
-- 在 Supabase → SQL Editor 整段执行。若仍报 PGRST205，Dashboard → Settings → API
-- 点「Reload schema」，或稍等缓存刷新。

create table if not exists public.brand_social_corpus (
  id uuid not null default gen_random_uuid (),
  brand_slug text not null,
  brand_name text not null,
  product_slug text null,
  source_platform text not null,
  title text null,
  snippet text not null default ''::text,
  source_url text not null,
  url_hash text not null,
  serp_query text null,
  serp_page integer not null default 1,
  collected_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint brand_social_corpus_pkey primary key (id),
  constraint brand_social_corpus_brand_url unique (brand_slug, url_hash)
);

create index if not exists brand_social_corpus_brand_slug_idx on public.brand_social_corpus using btree (brand_slug);

create index if not exists brand_social_corpus_platform_idx on public.brand_social_corpus using btree (source_platform);

alter table public.brand_social_corpus enable row level security;

drop policy if exists brand_social_corpus_select_anon on public.brand_social_corpus;

create policy brand_social_corpus_select_anon on public.brand_social_corpus for select to anon using (true);

grant select on table public.brand_social_corpus to anon, authenticated;

-- 写入脚本使用 service_role 的 SUPABASE_KEY（绕过 RLS）；无需为 anon 开 insert。
-- PostgREST 仍报 PGRST205 时：Dashboard → Settings → API →「Reload schema」。
