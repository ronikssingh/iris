-- Iris online features. Paste all of this into Supabase → SQL Editor → New query, then click Run.
-- It is safe to run more than once.

create extension if not exists citext;

-- People ------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  avatar text not null default 'preset:1' check (char_length(avatar) <= 400),
  bio text not null default '' check (char_length(bio) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Friends -----------------------------------------------------------------
create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index if not exists friendships_one_per_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;

-- Critiques shared with friends ---------------------------------------------
create table if not exists public.critiques (
  user_id uuid not null references public.profiles (id) on delete cascade,
  id text not null check (char_length(id) <= 120),
  title text not null check (char_length(title) between 1 and 300),
  type text not null check (type in ('movie', 'show', 'game')),
  year text not null default '' check (char_length(year) <= 12),
  ext_key text check (char_length(ext_key) <= 80),
  poster_url text check (char_length(poster_url) <= 500),
  director text not null default '' check (char_length(director) <= 400),
  studio text not null default '' check (char_length(studio) <= 400),
  cast_list text not null default '' check (char_length(cast_list) <= 2000),
  description text not null default '' check (char_length(description) <= 6000),
  comments text not null default '' check (char_length(comments) <= 20000),
  final_remarks text not null default '' check (char_length(final_remarks) <= 6000),
  scores jsonb not null,
  total int not null check (total between 0 and 1000),
  class text not null check (class in ('masterpiece', 'perfect', 'great', 'good', 'average', 'below', 'terrible')),
  recommend text check (recommend in ('yes', 'no')),
  favourite boolean not null default false,
  hidden boolean not null default false,
  genres text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);
-- added in Iris 1.2 so a critique comes back whole on another computer
alter table public.critiques add column if not exists score_notes jsonb not null default '{}';
alter table public.critiques add column if not exists class_override text;
alter table public.critiques add column if not exists poster_color text;
alter table public.critiques drop constraint if exists critiques_score_notes_size;
alter table public.critiques add constraint critiques_score_notes_size check (pg_column_size(score_notes) <= 24000);
alter table public.critiques drop constraint if exists critiques_class_override_valid;
alter table public.critiques add constraint critiques_class_override_valid
  check (class_override is null or class_override in ('masterpiece', 'perfect', 'great', 'good', 'average', 'below', 'terrible'));
alter table public.critiques drop constraint if exists critiques_poster_color_size;
alter table public.critiques add constraint critiques_poster_color_size check (poster_color is null or char_length(poster_color) <= 24);
create index if not exists critiques_recent on public.critiques (updated_at desc);
create index if not exists critiques_ext on public.critiques (ext_key);

-- Up Next and Discover, kept in step across your computers (private to you) ----------
create table if not exists public.watchlist (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  id text not null check (char_length(id) <= 120),
  title text not null check (char_length(title) between 1 and 300),
  type text not null check (type in ('movie', 'show', 'game')),
  status text not null default 'want' check (status in ('want', 'watched')),
  note text not null default '' check (char_length(note) <= 300),
  year text not null default '' check (char_length(year) <= 12),
  ext_key text check (char_length(ext_key) <= 80),
  poster_url text check (char_length(poster_url) <= 500),
  director text not null default '' check (char_length(director) <= 400),
  studio text not null default '' check (char_length(studio) <= 400),
  cast_list text not null default '' check (char_length(cast_list) <= 2000),
  description text not null default '' check (char_length(description) <= 6000),
  genres text[] not null default '{}',
  from_name text not null default '' check (char_length(from_name) <= 40),
  sort_order double precision not null default 0,
  added_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

create table if not exists public.swipes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  key text not null check (char_length(key) <= 80),
  title text not null default '' check (char_length(title) <= 300),
  type text not null check (type in ('movie', 'show', 'game')),
  verdict text not null check (verdict in ('like', 'skip', 'seen')),
  at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Likes and replies ---------------------------------------------------------
create table if not exists public.likes (
  owner uuid not null,
  critique_id text not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, critique_id, user_id),
  foreign key (owner, critique_id) references public.critiques (user_id, id) on delete cascade
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null,
  critique_id text not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  foreign key (owner, critique_id) references public.critiques (user_id, id) on delete cascade
);
create index if not exists comments_by_critique on public.comments (owner, critique_id, created_at);

-- Titles friends send each other --------------------------------------------
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  type text not null check (type in ('movie', 'show', 'game')),
  year text not null default '' check (char_length(year) <= 12),
  ext_key text check (char_length(ext_key) <= 80),
  poster_url text check (char_length(poster_url) <= 500),
  note text not null default '' check (char_length(note) <= 200),
  seen boolean not null default false,
  created_at timestamptz not null default now()
);

-- Who can see and change what -------------------------------------------------
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.critiques enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.suggestions enable row level security;
alter table public.watchlist enable row level security;
alter table public.swipes enable row level security;

drop policy if exists "profiles are visible to signed-in people" on public.profiles;
create policy "profiles are visible to signed-in people" on public.profiles for select to authenticated using (true);
drop policy if exists "make your own profile" on public.profiles;
create policy "make your own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "edit your own profile" on public.profiles;
create policy "edit your own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "see your own friendships" on public.friendships;
create policy "see your own friendships" on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
drop policy if exists "send a friend request" on public.friendships;
create policy "send a friend request" on public.friendships for insert to authenticated with check (requester = auth.uid() and status = 'pending');
drop policy if exists "accept a request sent to you" on public.friendships;
create policy "accept a request sent to you" on public.friendships for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
drop policy if exists "remove a friendship or request" on public.friendships;
create policy "remove a friendship or request" on public.friendships for delete to authenticated using (auth.uid() in (requester, addressee));

drop policy if exists "see your own and friends' critiques" on public.critiques;
create policy "see your own and friends' critiques" on public.critiques for select to authenticated
  using (user_id = auth.uid() or (not hidden and public.are_friends(auth.uid(), user_id)));
drop policy if exists "add your own critiques" on public.critiques;
create policy "add your own critiques" on public.critiques for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "change your own critiques" on public.critiques;
create policy "change your own critiques" on public.critiques for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "delete your own critiques" on public.critiques;
create policy "delete your own critiques" on public.critiques for delete to authenticated using (user_id = auth.uid());

drop policy if exists "see likes on critiques you can see" on public.likes;
create policy "see likes on critiques you can see" on public.likes for select to authenticated
  using (exists (select 1 from public.critiques c where c.user_id = owner and c.id = critique_id));
drop policy if exists "like critiques you can see" on public.likes;
create policy "like critiques you can see" on public.likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.critiques c where c.user_id = owner and c.id = critique_id));
drop policy if exists "take back your like" on public.likes;
create policy "take back your like" on public.likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "see replies on critiques you can see" on public.comments;
create policy "see replies on critiques you can see" on public.comments for select to authenticated
  using (exists (select 1 from public.critiques c where c.user_id = owner and c.id = critique_id));
drop policy if exists "reply to critiques you can see" on public.comments;
create policy "reply to critiques you can see" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.critiques c where c.user_id = owner and c.id = critique_id));
drop policy if exists "delete your replies or replies on your critique" on public.comments;
create policy "delete your replies or replies on your critique" on public.comments for delete to authenticated
  using (user_id = auth.uid() or owner = auth.uid());

drop policy if exists "see suggestions you sent or got" on public.suggestions;
create policy "see suggestions you sent or got" on public.suggestions for select to authenticated using (auth.uid() in (from_user, to_user));
drop policy if exists "suggest titles to friends" on public.suggestions;
create policy "suggest titles to friends" on public.suggestions for insert to authenticated
  with check (from_user = auth.uid() and public.are_friends(from_user, to_user));
drop policy if exists "mark suggestions as seen" on public.suggestions;
create policy "mark suggestions as seen" on public.suggestions for update to authenticated using (to_user = auth.uid()) with check (to_user = auth.uid());
drop policy if exists "remove suggestions" on public.suggestions;
create policy "remove suggestions" on public.suggestions for delete to authenticated using (auth.uid() in (from_user, to_user));

drop policy if exists "your own list" on public.watchlist;
create policy "your own list" on public.watchlist for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "your own swipes" on public.swipes;
create policy "your own swipes" on public.swipes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Accepting stamps the time; nobody can rewrite who sent a request.
create or replace function public.friendship_guard()
returns trigger language plpgsql as $$
begin
  if new.requester <> old.requester or new.addressee <> old.addressee then
    raise exception 'friendships cannot be moved';
  end if;
  if new.status = 'accepted' and old.status <> 'accepted' then
    new.accepted_at := now();
  end if;
  return new;
end $$;
drop trigger if exists friendship_guard on public.friendships;
create trigger friendship_guard before update on public.friendships for each row execute function public.friendship_guard();

-- Lets someone delete their own online account (their critiques at home are untouched).
create or replace function public.delete_my_account()
returns void language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.friendships, public.critiques, public.likes, public.comments, public.suggestions, public.watchlist, public.swipes to authenticated;
-- Nothing here is for people who aren't signed in.
revoke all on public.profiles, public.friendships, public.critiques, public.likes, public.comments, public.suggestions, public.watchlist, public.swipes from anon;
revoke all on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Changes are limited to the parts that are yours to change: accepting a request changes only its status,
-- marking a suggestion seen changes only that, and a profile keeps its id and creation time.
revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar, bio, updated_at) on public.profiles to authenticated;
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;
revoke update on public.suggestions from authenticated;
grant update (seen) on public.suggestions to authenticated;

-- Anyone signed in can see a username and profile picture (that's how friends find each other).
-- Names and the line about your taste are only for you and your friends, through profile_details().
revoke select on public.profiles from authenticated, anon;
grant select (id, username, avatar, created_at, updated_at) on public.profiles to authenticated;

create or replace function public.profile_details(ids uuid[])
returns table (id uuid, display_name text, bio text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.bio
  from public.profiles p
  where p.id = any(ids) and (p.id = auth.uid() or public.are_friends(auth.uid(), p.id));
$$;
revoke all on function public.profile_details(uuid[]) from public, anon;
grant execute on function public.profile_details(uuid[]) to authenticated;

-- Pictures: profile pictures and posters, each person writes only into their own folder.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('posters', 'posters', true) on conflict (id) do nothing;
-- pictures only, and nothing huge
update storage.buckets set file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id in ('avatars', 'posters');

drop policy if exists "upload into your own folder" on storage.objects;
create policy "upload into your own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'posters') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "replace files in your own folder" on storage.objects;
create policy "replace files in your own folder" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'posters') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "delete files in your own folder" on storage.objects;
create policy "delete files in your own folder" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'posters') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "read your own files" on storage.objects;
create policy "read your own files" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'posters') and (storage.foldername(name))[1] = auth.uid()::text);
