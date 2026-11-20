begin;

create table if not exists public.farewell_notes (
  id uuid primary key,
  author text not null default '' check (char_length(author) <= 50),
  message text not null check (
    char_length(message) between 1 and 500 and message ~ '[^[:space:]]'
  ),
  created_at timestamptz not null default now()
);

alter table public.farewell_notes enable row level security;

revoke all on table public.farewell_notes from public, anon, authenticated;
grant select on table public.farewell_notes to anon;
grant insert (id, author, message) on table public.farewell_notes to anon;

drop policy if exists "Anyone can read farewell notes" on public.farewell_notes;
create policy "Anyone can read farewell notes"
on public.farewell_notes for select to anon using (true);

drop policy if exists "Anyone can write farewell notes" on public.farewell_notes;
create policy "Anyone can write farewell notes"
on public.farewell_notes for insert to anon with check (true);

commit;
