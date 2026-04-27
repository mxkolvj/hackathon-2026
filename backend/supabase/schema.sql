-- Run in Supabase SQL editor.
-- Either disable RLS on this table OR ensure the backend uses the service-role key.

create table if not exists votes (
  url text not null,
  user_hash text not null,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (url, user_hash)
);

create index if not exists votes_url_idx on votes (url);
