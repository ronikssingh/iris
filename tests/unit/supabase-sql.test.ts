// Runs supabase/setup.sql on a real (in-process) Postgres with stand-ins for Supabase's auth and storage
// schemas, then checks that every person can only see and change what they should.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';

const SQL = fs.readFileSync(path.resolve('supabase/setup.sql'), 'utf8');
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';

const STUBS = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id serial primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant usage, select on sequence storage.objects_id_seq to authenticated;
grant execute on function storage.foldername(text) to authenticated;
`;

let db: PGlite;

async function as<T>(who: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${who}', false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
const q = (sql: string, params: unknown[] = []) => db.query<any>(sql, params).then((r) => r.rows);
const fails = async (sql: string, params: unknown[] = []) => {
  try {
    await db.query(sql, params);
    return false;
  } catch {
    return true;
  }
};

const critique = (owner: string, id: string, hidden = false) =>
  q(
    `insert into public.critiques (user_id, id, title, type, scores, total, class, hidden, created_at, updated_at)
     values ($1, $2, $3, 'movie', '{"story": 90}', 900, 'perfect', $4, now(), now())`,
    [owner, id, 'Film ' + id, hidden],
  );

describe('supabase/setup.sql', () => {
  beforeAll(async () => {
    db = new PGlite({ extensions: { citext } });
    await db.exec(STUBS);
    await db.exec(SQL);
    await db.exec(SQL); // safe to run twice
    await db.exec(`insert into auth.users values ('${A}'), ('${B}'), ('${C}')`);
  }, 60000);

  it('lets people make only their own profile, with a valid username', async () => {
    await as(A, () => q(`insert into public.profiles (id, username) values ($1, 'ronik')`, [A]));
    await as(B, () => q(`insert into public.profiles (id, username) values ($1, 'sam.k')`, [B]));
    await as(C, () => q(`insert into public.profiles (id, username) values ($1, 'cleo_9')`, [C]));
    expect(await as(C, () => fails(`insert into public.profiles (id, username) values ($1, 'someone')`, [A]))).toBe(true);
    expect(await as(C, () => fails(`update public.profiles set username = 'Bad Name!' where id = $1`, [C]))).toBe(true);
    expect(await as(B, () => fails(`update public.profiles set username = 'RONIK' where id = $1`, [B]))).toBe(true); // usernames ignore case
    const seen = await as(C, () => q(`select username from public.profiles order by username`));
    expect(seen.map((r) => r.username)).toEqual(['cleo_9', 'ronik', 'sam.k']);
    await as(C, () => q(`update public.profiles set bio = 'hacked' where id = $1`, [A]));
    expect((await q(`select bio from public.profiles where id = $1`, [A]))[0].bio).toBe('');
  });

  it('handles friend requests', async () => {
    await as(A, () => q(`insert into public.friendships (requester, addressee) values ($1, $2)`, [A, B]));
    expect(await as(B, () => fails(`insert into public.friendships (requester, addressee) values ($1, $2)`, [B, A]))).toBe(true);
    expect(await as(C, () => fails(`insert into public.friendships (requester, addressee, status) values ($1, $2, 'accepted')`, [C, A]))).toBe(true);
    // only the person asked can accept
    await as(A, () => q(`update public.friendships set status = 'accepted' where requester = $1 and addressee = $2`, [A, B]));
    expect((await q(`select status from public.friendships`))[0].status).toBe('pending');
    await as(B, () => q(`update public.friendships set status = 'accepted' where requester = $1 and addressee = $2`, [A, B]));
    const row = (await q(`select status, accepted_at from public.friendships`))[0];
    expect(row.status).toBe('accepted');
    expect(row.accepted_at).not.toBeNull();
    expect(await as(C, () => q(`select * from public.friendships`))).toHaveLength(0);
  });

  it('keeps names and the taste line for friends only', async () => {
    await as(A, () => q(`update public.profiles set display_name = 'Ronik', bio = 'Sci-fi first' where id = $1`, [A]));
    // strangers can see usernames and pictures, but not names or bios
    expect(await as(C, () => fails(`select display_name from public.profiles`))).toBe(true);
    expect(await as(C, () => fails(`select * from public.profiles`))).toBe(true);
    expect((await as(C, () => q(`select id, username, avatar, created_at from public.profiles`))).length).toBe(3);
    expect(await as(C, () => q(`select * from public.profile_details(array[$1]::uuid[])`, [A]))).toHaveLength(0);
    // friends and yourself can
    const forB = await as(B, () => q(`select display_name, bio from public.profile_details(array[$1, $2]::uuid[])`, [A, C]));
    expect(forB).toEqual([{ display_name: 'Ronik', bio: 'Sci-fi first' }]);
    expect(await as(C, () => q(`select id from public.profile_details(array[$1]::uuid[])`, [C]))).toHaveLength(1);
  });

  it('shows critiques only to their owner and friends, and never hidden ones', async () => {
    await as(A, () => critique(A, 'c1'));
    await as(A, () => critique(A, 'c2', true));
    expect(await as(C, () => fails(`insert into public.critiques (user_id, id, title, type, scores, total, class, created_at, updated_at) values ($1, 'x', 'X', 'movie', '{}', 1, 'terrible', now(), now())`, [A]))).toBe(true);
    expect((await as(A, () => q(`select id from public.critiques order by id`))).map((r) => r.id)).toEqual(['c1', 'c2']);
    expect((await as(B, () => q(`select id from public.critiques`))).map((r) => r.id)).toEqual(['c1']);
    expect(await as(C, () => q(`select id from public.critiques`))).toHaveLength(0);
    await as(B, () => q(`update public.critiques set title = 'changed' where user_id = $1`, [A]));
    expect((await q(`select title from public.critiques where id = 'c1'`))[0].title).toBe('Film c1');
  });

  it('lets friends like and reply, but not strangers', async () => {
    await as(B, () => q(`insert into public.likes (owner, critique_id) values ($1, 'c1')`, [A]));
    expect(await as(B, () => fails(`insert into public.likes (owner, critique_id) values ($1, 'c2')`, [A]))).toBe(true);
    expect(await as(C, () => fails(`insert into public.likes (owner, critique_id) values ($1, 'c1')`, [A]))).toBe(true);
    await as(B, () => q(`insert into public.comments (owner, critique_id, body) values ($1, 'c1', 'Great take')`, [A]));
    expect(await as(C, () => fails(`insert into public.comments (owner, critique_id, body) values ($1, 'c1', 'hi')`, [A]))).toBe(true);
    expect(await as(B, () => fails(`insert into public.comments (owner, critique_id, body) values ($1, 'c1', '')`, [A]))).toBe(true);
    expect(await as(A, () => q(`select body from public.comments`))).toHaveLength(1);
    expect(await as(C, () => q(`select body from public.comments`))).toHaveLength(0);
    // the critique's owner can remove replies on it
    await as(A, () => q(`delete from public.comments`));
    expect(await q(`select * from public.comments`)).toHaveLength(0);
  });

  it('only sends suggestions between friends', async () => {
    await as(A, () => q(`insert into public.suggestions (to_user, title, type) values ($1, 'Arrival', 'movie')`, [B]));
    expect(await as(A, () => fails(`insert into public.suggestions (to_user, title, type) values ($1, 'Arrival', 'movie')`, [C]))).toBe(true);
    expect(await as(B, () => q(`select title from public.suggestions`))).toHaveLength(1);
    expect(await as(C, () => q(`select title from public.suggestions`))).toHaveLength(0);
  });

  it('keeps pictures in each person’s own folder', async () => {
    await as(A, () => q(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${A}/me.jpg`]));
    expect(await as(A, () => fails(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${B}/me.jpg`]))).toBe(true);
    expect(await as(A, () => fails(`insert into storage.objects (bucket_id, name) values ('other', $1)`, [`${A}/me.jpg`]))).toBe(true);
  });

  it('removes everything when someone deletes their account', async () => {
    await as(A, () => q(`select public.delete_my_account()`));
    expect(await q(`select * from public.profiles where id = $1`, [A])).toHaveLength(0);
    expect(await q(`select * from public.critiques`)).toHaveLength(0);
    expect(await q(`select * from public.friendships`)).toHaveLength(0);
  });
});
