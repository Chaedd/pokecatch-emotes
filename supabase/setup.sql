-- Poke'Catch · Emote contest — whole backend, one file.
-- Run it in the SQL editor of the contest's OWN Supabase project (never the game's).
-- Safe to run again after an edit.

-- ───────────────────────── 0. TO FILL IN ─────────────────────────
-- Discord: Settings › Advanced › Developer mode, then right-click › Copy ID.

create table if not exists public.config (
  id boolean primary key default true check (id),
  guild_id text not null,
  submissions_open boolean not null default true,
  votes_open boolean not null default false,
  show_counts boolean not null default false,
  max_votes int not null default 3,
  max_emotes int not null default 30
);
insert into public.config (guild_id) values ('1558172928649207899')        -- ← the Poke'Catch server ID
on conflict (id) do nothing;

create table if not exists public.admins (discord_id text primary key);
insert into public.admins values ('203581652809547776')        -- ← your own Discord user ID
on conflict do nothing;

-- ───────────────────────── 1. Tables ─────────────────────────

create extension if not exists http with schema extensions;

create table if not exists public.members (
  user_id uuid primary key references auth.users on delete cascade,
  discord_id text not null,
  name text not null,
  avatar text,
  checked_at timestamptz not null default now()
);

create table if not exists public.lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users on delete cascade,
  title text not null,
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.emotes (
  lot_id uuid not null references public.lots on delete cascade,
  pos int not null,
  name text not null,
  path text not null,
  primary key (lot_id, pos)
);

create table if not exists public.votes (
  lot_id uuid not null references public.lots on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lot_id, user_id)
);

-- No policy on purpose: nothing is read or written except through the functions below.
alter table public.config  enable row level security;
alter table public.admins  enable row level security;
alter table public.members enable row level security;
alter table public.lots    enable row level security;
alter table public.emotes  enable row level security;
alter table public.votes   enable row level security;

-- ───────────────────────── 2. Who is calling ─────────────────────────

-- The Discord ID comes from auth.identities (written by Supabase at login),
-- never from user_metadata, which a user can edit.
create or replace function public.discord_id() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(i.provider_id, i.identity_data->>'sub')
  from auth.identities i
  where i.user_id = auth.uid() and i.provider = 'discord'
  limit 1
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.user_id = auth.uid())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.discord_id = public.discord_id())
$$;

-- Asks Discord, with the token of the login, whether this account is on the server.
create or replace function public.verify_member(token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  did text := public.discord_id();
  gid text;
  st int;
  raw text;
  body jsonb;
begin
  if uid is null or did is null then raise exception 'login'; end if;
  if token is null or token !~ '^[A-Za-z0-9._-]{10,200}$' then raise exception 'token'; end if;
  select c.guild_id into gid from public.config c;
  select r.status, r.content into st, raw
  from extensions.http((
    'GET',
    'https://discord.com/api/v10/users/@me/guilds/' || gid || '/member',
    array[extensions.http_header('Authorization', 'Bearer ' || token)],
    null, null
  )::extensions.http_request) r;
  if st <> 200 then
    return jsonb_build_object('member', false, 'status', st);
  end if;
  body := raw::jsonb;
  if body->'user'->>'id' is distinct from did then raise exception 'mismatch'; end if;
  insert into public.members (user_id, discord_id, name, avatar)
  values (
    uid, did,
    left(coalesce(nullif(body->>'nick', ''), nullif(body->'user'->>'global_name', ''), body->'user'->>'username', 'Trainer'), 40),
    case when body->'user'->>'avatar' ~ '^[a-z0-9_]+$'
      then 'https://cdn.discordapp.com/avatars/' || did || '/' || (body->'user'->>'avatar') || '.png?size=64' end
  )
  on conflict (user_id) do update
    set discord_id = excluded.discord_id, name = excluded.name, avatar = excluded.avatar, checked_at = now();
  return jsonb_build_object('member', true);
end $$;

-- ───────────────────────── 3. Reading ─────────────────────────

create or replace function public.lot_json(l public.lots, with_votes boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', l.id,
    'title', l.title,
    'note', l.note,
    'status', l.status,
    'created_at', l.created_at,
    'author', (select m.name from public.members m where m.user_id = l.user_id),
    'avatar', (select m.avatar from public.members m where m.user_id = l.user_id),
    'mine', l.user_id = auth.uid(),
    'voted', exists (select 1 from public.votes v where v.lot_id = l.id and v.user_id = auth.uid()),
    'votes', case when with_votes then (select count(*) from public.votes v where v.lot_id = l.id) end,
    'emotes', coalesce((
      select jsonb_agg(jsonb_build_object('name', e.name, 'path', e.path) order by e.pos)
      from public.emotes e where e.lot_id = l.id), '[]'::jsonb)
  )
$$;
-- A helper only: called directly it would show a lot that is not approved yet.
revoke execute on function public.lot_json(public.lots, boolean) from public, anon, authenticated;

-- Everything the page needs, in one call. Approved lots only, in an order that
-- differs for each visitor (no lot is always first).
create or replace function public.state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'config', (select jsonb_build_object(
        'submissions_open', c.submissions_open, 'votes_open', c.votes_open,
        'show_counts', c.show_counts, 'max_votes', c.max_votes, 'max_emotes', c.max_emotes)
      from public.config c),
    'me', case when auth.uid() is null then null else jsonb_build_object(
        'member', public.is_member(),
        'admin', public.is_admin(),
        'name', (select m.name from public.members m where m.user_id = auth.uid()),
        'avatar', (select m.avatar from public.members m where m.user_id = auth.uid()),
        'votes_used', (select count(*) from public.votes v where v.user_id = auth.uid())) end,
    'mine', (select public.lot_json(l, false) from public.lots l where l.user_id = auth.uid()),
    'lots', coalesce((
      select jsonb_agg(
        public.lot_json(l, (select c.show_counts from public.config c))
        order by md5(l.id::text || coalesce(auth.uid()::text, '')))
      from public.lots l where l.status = 'approved'), '[]'::jsonb)
  )
$$;

-- ───────────────────────── 4. Submitting and voting ─────────────────────────

create or replace function public.emote_files(uid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from storage.objects o
  where o.bucket_id = 'emotes' and (storage.foldername(o.name))[1] = uid::text
$$;
revoke execute on function public.emote_files(uuid) from public, anon;

-- One lot per member. Sending again replaces it: back to « pending », votes cleared.
create or replace function public.submit_lot(p_title text, p_note text, p_emotes jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cfg public.config;
  e jsonb;
  names text[] := '{}';
  lid uuid;
  i int := 0;
begin
  if uid is null or not public.is_member() then raise exception 'member'; end if;
  select * into cfg from public.config;
  if not cfg.submissions_open then raise exception 'closed'; end if;
  p_title := btrim(coalesce(p_title, ''));
  if char_length(p_title) not between 1 and 60 then raise exception 'title'; end if;
  if jsonb_typeof(p_emotes) is distinct from 'array'
     or jsonb_array_length(p_emotes) not between 1 and cfg.max_emotes then
    raise exception 'count';
  end if;
  for e in select * from jsonb_array_elements(p_emotes) loop
    if coalesce(e->>'name', '') !~ '^[a-z0-9_]{2,32}$' or (e->>'name') = any (names) then
      raise exception 'name';
    end if;
    if coalesce(e->>'path', '') !~ ('^' || uid::text || '/[a-f0-9-]{36}\.(png|gif)$') then
      raise exception 'path';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'emotes' and o.name = e->>'path') then
      raise exception 'file';
    end if;
    names := names || (e->>'name');
  end loop;
  delete from public.lots where user_id = uid;
  insert into public.lots (user_id, title, note)
  values (uid, p_title, left(btrim(coalesce(p_note, '')), 300))
  returning id into lid;
  for e in select * from jsonb_array_elements(p_emotes) loop
    insert into public.emotes (lot_id, pos, name, path) values (lid, i, e->>'name', e->>'path');
    i := i + 1;
  end loop;
  return lid;
end $$;

create or replace function public.vote(p_lot uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cfg public.config;
  l public.lots;
begin
  if uid is null or not public.is_member() then raise exception 'member'; end if;
  select * into cfg from public.config;
  if not cfg.votes_open then raise exception 'novote'; end if;
  if not p_on then
    delete from public.votes where lot_id = p_lot and user_id = uid;
    return;
  end if;
  select * into l from public.lots where id = p_lot and status = 'approved';
  if not found then raise exception 'lot'; end if;
  if l.user_id = uid then raise exception 'own'; end if;
  -- one voter at a time, so two fast clicks cannot go over the limit
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if (select count(*) from public.votes where user_id = uid and lot_id <> p_lot) >= cfg.max_votes then
    raise exception 'maxvotes';
  end if;
  insert into public.votes (lot_id, user_id) values (p_lot, uid) on conflict do nothing;
end $$;

-- ───────────────────────── 5. Moderation (admins only) ─────────────────────────

create or replace function public.admin_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin'; end if;
  return jsonb_build_object(
    'config', (select to_jsonb(c) - 'id' - 'guild_id' from public.config c),
    'members', (select count(*) from public.members),
    'lots', coalesce((
      select jsonb_agg(public.lot_json(l, true) order by l.created_at desc) from public.lots l), '[]'::jsonb));
end $$;

create or replace function public.admin_set(p_lot uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin'; end if;
  update public.lots set status = p_status where id = p_lot;
end $$;

-- Deletes the lot and returns its file paths, for the page to remove from Storage.
create or replace function public.admin_delete(p_lot uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare paths jsonb;
begin
  if not public.is_admin() then raise exception 'admin'; end if;
  select coalesce(jsonb_agg(e.path), '[]'::jsonb) into paths from public.emotes e where e.lot_id = p_lot;
  delete from public.lots where id = p_lot;
  return paths;
end $$;

create or replace function public.admin_config(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin'; end if;
  update public.config set
    submissions_open = coalesce((p->>'submissions_open')::boolean, submissions_open),
    votes_open       = coalesce((p->>'votes_open')::boolean, votes_open),
    show_counts      = coalesce((p->>'show_counts')::boolean, show_counts),
    max_votes        = least(greatest(coalesce((p->>'max_votes')::int, max_votes), 1), 20)
  where id;   -- the single row; Supabase refuses an UPDATE without WHERE
end $$;

-- ───────────────────────── 6. Storage ─────────────────────────
-- Images only, 256 KB each (the limit of a Discord emote), 80 files per member.
-- Public bucket: an image is shown by its address, but nobody can list the files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('emotes', 'emotes', true, 262144, array['image/png', 'image/gif'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists emotes_insert on storage.objects;
create policy emotes_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'emotes'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_member()
  and public.emote_files(auth.uid()) < 80
);

drop policy if exists emotes_select on storage.objects;
create policy emotes_select on storage.objects for select to authenticated using (
  bucket_id = 'emotes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

drop policy if exists emotes_delete on storage.objects;
create policy emotes_delete on storage.objects for delete to authenticated using (
  bucket_id = 'emotes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
