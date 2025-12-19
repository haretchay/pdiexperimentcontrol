-- Create experiments table
create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  number integer not null,
  strain text not null,
  start_date timestamp with time zone not null,
  test_count integer not null,
  repetition_count integer not null,
  total_tests integer not null,
  test_types jsonb,
  created_at timestamp with time zone default now()
);

-- Create tests table
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  experiment_id uuid references public.experiments(id) on delete cascade not null,
  repetition_number integer not null,
  test_number integer not null,
  unit text,
  requisition text,
  test_lot text,
  matrix_lot text,
  strain text,
  mp_lot text,
  average_humidity numeric,
  bozo text,
  sensorial text,
  quantity numeric,
  test_type text,
  date_7_day timestamp with time zone,
  date_14_day timestamp with time zone,
  temp_7_chamber numeric,
  temp_7_rice numeric,
  temp_14_chamber numeric,
  temp_14_rice numeric,
  wet_weight numeric,
  dry_weight numeric,
  extracted_conidium_weight numeric,
  photos_7_day jsonb,
  photos_14_day jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(experiment_id, repetition_number, test_number)
);

-- Enable Row Level Security
alter table public.experiments enable row level security;
alter table public.tests enable row level security;

-- RLS Policies for experiments table
create policy "Users can view their own experiments"
  on public.experiments for select
  using (auth.uid() = user_id);

create policy "Users can insert their own experiments"
  on public.experiments for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own experiments"
  on public.experiments for update
  using (auth.uid() = user_id);

create policy "Users can delete their own experiments"
  on public.experiments for delete
  using (auth.uid() = user_id);

-- RLS Policies for tests table
create policy "Users can view their own tests"
  on public.tests for select
  using (auth.uid() = user_id);

create policy "Users can insert their own tests"
  on public.tests for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tests"
  on public.tests for update
  using (auth.uid() = user_id);

create policy "Users can delete their own tests"
  on public.tests for delete
  using (auth.uid() = user_id);

-- Create indexes for better performance
create index if not exists experiments_user_id_idx on public.experiments(user_id);
create index if not exists experiments_created_at_idx on public.experiments(created_at desc);
create index if not exists tests_user_id_idx on public.tests(user_id);
create index if not exists tests_experiment_id_idx on public.tests(experiment_id);
create index if not exists tests_repetition_test_idx on public.tests(experiment_id, repetition_number, test_number);
