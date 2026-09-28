create table orders (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  table_no text not null,
  items jsonb not null,
  total numeric not null,
  note text,
  status text not null default 'new'
);

alter table orders enable row level security;
create policy "anyone can order" on orders for insert with check (true);
create policy "read orders" on orders for select using (true);
create policy "update orders" on orders for update using (true);
