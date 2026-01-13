-- Create experiments table
create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  number integer not null,
  strain text not null,
  start_date date not null,
  test_count integer not null check (test_count >= 1),
  repetition_count integer not null check (repetition_count >= 1),
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamp with time zone not null default now()
);

-- Create tests table
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  repetition_number integer not null check (repetition_number >= 1),
  test_number integer not null check (test_number >= 1),
  unit text,
  requisition text,
  test_type text,
  test_lot text,
  matrix_lot text,
  strain text,
  mp_lot text,
  average_humidity numeric,
  bozo numeric,
  sensorial numeric,
  quantity numeric,
  temp7_chamber numeric,
  temp14_chamber numeric,
  temp7_rice numeric,
  temp14_rice numeric,
  wet_weight numeric,
  dry_weight numeric,
  extracted_conidium_weight numeric,
  date_7_day timestamp with time zone,
  date_14_day timestamp with time zone,
  annotations_7_day jsonb,
  annotations_14_day jsonb,
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Create test_photos table
create table if not exists public.test_photos (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  day integer not null check (day = any(array[7, 14])),
  storage_path text not null,
  created_at timestamp with time zone not null default now()
);

-- Enable Row Level Security
alter table public.experiments enable row level security;
alter table public.tests enable row level security;
alter table public.test_photos enable row level security;

-- RLS Policies for experiments table
create policy "Users can view their own experiments"
  on public.experiments for select
  using (auth.uid() = created_by);

create policy "Users can insert their own experiments"
  on public.experiments for insert
  with check (auth.uid() = created_by);

create policy "Users can update their own experiments"
  on public.experiments for update
  using (auth.uid() = created_by);

create policy "Users can delete their own experiments"
  on public.experiments for delete
  using (auth.uid() = created_by);

-- RLS Policies for tests table
create policy "Users can view their own tests"
  on public.tests for select
  using (auth.uid() = created_by);

create policy "Users can insert their own tests"
  on public.tests for insert
  with check (auth.uid() = created_by);

create policy "Users can update their own tests"
  on public.tests for update
  using (auth.uid() = created_by);

create policy "Users can delete their own tests"
  on public.tests for delete
  using (auth.uid() = created_by);

-- RLS Policies for test_photos table
create policy "Users can view photos from their own tests"
  on public.test_photos for select
  using (
    exists (
      select 1 from public.tests
      where tests.id = test_photos.test_id
      and tests.created_by = auth.uid()
    )
  );

create policy "Users can insert photos to their own tests"
  on public.test_photos for insert
  with check (
    exists (
      select 1 from public.tests
      where tests.id = test_photos.test_id
      and tests.created_by = auth.uid()
    )
  );

create policy "Users can delete photos from their own tests"
  on public.test_photos for delete
  using (
    exists (
      select 1 from public.tests
      where tests.id = test_photos.test_id
      and tests.created_by = auth.uid()
    )
  );

-- Create indexes for better performance
create index if not exists experiments_created_by_idx on public.experiments(created_by);
create index if not exists experiments_created_at_idx on public.experiments(created_at desc);
create index if not exists tests_created_by_idx on public.tests(created_by);
create index if not exists tests_experiment_id_idx on public.tests(experiment_id);
create index if not exists tests_repetition_test_idx on public.tests(experiment_id, repetition_number, test_number);
create index if not exists test_photos_test_id_idx on public.test_photos(test_id);
