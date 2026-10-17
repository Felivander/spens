-- ============================================================================
-- Spens — Supabase Database Migration & Row Level Security (RLS) Setup
-- Paste and run this script in your Supabase SQL Editor (https://supabase.com)
-- ============================================================================

-- 1. Create the movements table
create table if not exists public.movements (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text check (kind in ('gasto', 'ingreso')) not null,
  amount numeric not null check (amount > 0),
  description text not null,
  category text not null,
  date text not null,
  created_at bigint not null,
  person text -- set on loans between people; null for regular movements
);

-- 1b. Migration for databases created before loans existed (safe to re-run)
alter table public.movements add column if not exists person text;

-- 2. Enable Row Level Security (RLS)
alter table public.movements enable row level security;

-- 3. Create RLS Policies so each authenticated user can only access their own rows

-- Select policy
create policy "Users can view their own movements"
  on public.movements for select
  using (auth.uid() = user_id);

-- Insert policy
create policy "Users can insert their own movements"
  on public.movements for insert
  with check (auth.uid() = user_id);

-- Update policy
create policy "Users can update their own movements"
  on public.movements for update
  using (auth.uid() = user_id);

-- Delete policy
create policy "Users can delete their own movements"
  on public.movements for delete
  using (auth.uid() = user_id);

-- 4. Create indices for fast user & date queries
create index if not exists movements_user_id_idx on public.movements(user_id);
create index if not exists movements_date_idx on public.movements(date);
