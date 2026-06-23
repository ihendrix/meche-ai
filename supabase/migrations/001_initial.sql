create extension if not exists pgcrypto;

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled analysis',
  settings jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.analysis_files (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  filename text not null,
  data_kind text not null check (data_kind in ('curve', 'summary')),
  status text not null,
  strain_column text,
  stress_column text,
  source_stress_unit text,
  diagnostics jsonb not null default '{}'::jsonb,
  curve_data jsonb not null default '[]'::jsonb,
  source_path text,
  cleaned_path text,
  created_at timestamptz not null default now()
);

create table public.analysis_metrics (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  file_name text not null,
  data_type text not null,
  peak_stress_mpa double precision,
  strain_at_peak double precision,
  youngs_modulus_mpa double precision,
  modulus_r2 double precision,
  modulus_fit text not null,
  area_under_curve double precision,
  rows integer not null default 0,
  detected_strain_column text,
  detected_stress_column text,
  created_at timestamptz not null default now()
);

create index analyses_user_created_idx on public.analyses(user_id, created_at desc);
create index analysis_files_analysis_idx on public.analysis_files(analysis_id);
create index analysis_metrics_analysis_idx on public.analysis_metrics(analysis_id);

alter table public.analyses enable row level security;
alter table public.analysis_files enable row level security;
alter table public.analysis_metrics enable row level security;

create policy "Users manage their analyses"
on public.analyses for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users read their analysis files"
on public.analysis_files for select to authenticated
using (
  exists (
    select 1 from public.analyses
    where analyses.id = analysis_files.analysis_id
      and analyses.user_id = auth.uid()
  )
);

create policy "Users insert their analysis files"
on public.analysis_files for insert to authenticated
with check (
  exists (
    select 1 from public.analyses
    where analyses.id = analysis_files.analysis_id
      and analyses.user_id = auth.uid()
  )
);

create policy "Users update their analysis files"
on public.analysis_files for update to authenticated
using (
  exists (
    select 1 from public.analyses
    where analyses.id = analysis_files.analysis_id
      and analyses.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.analyses
    where analyses.id = analysis_files.analysis_id
      and analyses.user_id = auth.uid()
  )
);

create policy "Users delete their analysis files"
on public.analysis_files for delete to authenticated
using (
  exists (
    select 1 from public.analyses
    where analyses.id = analysis_files.analysis_id
      and analyses.user_id = auth.uid()
  )
);

create policy "Users read their metrics"
on public.analysis_metrics for select to authenticated
using (
  exists (
    select 1 from public.analyses
    where analyses.id = analysis_metrics.analysis_id
      and analyses.user_id = auth.uid()
  )
);

create policy "Users insert their metrics"
on public.analysis_metrics for insert to authenticated
with check (
  exists (
    select 1 from public.analyses
    where analyses.id = analysis_metrics.analysis_id
      and analyses.user_id = auth.uid()
  )
);

create policy "Users update their metrics"
on public.analysis_metrics for update to authenticated
using (
  exists (
    select 1 from public.analyses
    where analyses.id = analysis_metrics.analysis_id
      and analyses.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.analyses
    where analyses.id = analysis_metrics.analysis_id
      and analyses.user_id = auth.uid()
  )
);

create policy "Users delete their metrics"
on public.analysis_metrics for delete to authenticated
using (
  exists (
    select 1 from public.analyses
    where analyses.id = analysis_metrics.analysis_id
      and analyses.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('mechanical-files', 'mechanical-files', false)
on conflict (id) do nothing;

create policy "Users upload to their own mechanical folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mechanical-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users read their own mechanical files"
on storage.objects for select to authenticated
using (
  bucket_id = 'mechanical-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users update their own mechanical files"
on storage.objects for update to authenticated
using (
  bucket_id = 'mechanical-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'mechanical-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users delete their own mechanical files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'mechanical-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
