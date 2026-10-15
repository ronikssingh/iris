import fsp from 'node:fs/promises';
import path from 'node:path';
import { net } from 'electron';
import { ensureDir, exists, sha256, writeFileAtomic } from './fsutil';

export const MEDIA_NAME = /^[a-f0-9]{16,64}\.(jpg|jpeg|png|webp|gif)$/;
export const USER_AGENT = 'Iris/1.0 (personal critique journal; https://github.com/ronikssingh/iris)';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export async function saveMedia(dir: string, bytes: Uint8Array, ext: string): Promise<string> {
  const e = ext.toLowerCase().replace('jpeg', 'jpg');
  if (!['jpg', 'png', 'webp', 'gif'].includes(e)) throw new Error('Unsupported image type');
  if (bytes.byteLength > 25 * 1024 * 1024) throw new Error('That image is too large (over 25 MB).');
  await ensureDir(dir);
  const name = sha256(bytes).slice(0, 40) + '.' + e;
  const file = path.join(dir, name);
  if (!(await exists(file))) await writeFileAtomic(file, bytes);
  return name;
}

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; ext: string } | null {
  const m = /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!m) return null;
  return { bytes: new Uint8Array(Buffer.from(m[2], 'base64')), ext: m[1] === 'jpeg' ? 'jpg' : m[1] };
}

export function mimeFor(name: string): string {
  return MIME[name.split('.').pop()!.toLowerCase()] || 'application/octet-stream';
}

/** Serves iris-media://m/<name> from the media folder. */
export async function serveMedia(dir: string, url: string): Promise<Response> {
  try {
    const u = new URL(url);
    const name = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    if (!MEDIA_NAME.test(name)) return new Response('Not found', { status: 404 });
    const data = await fsp.readFile(path.join(dir, name));
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': mimeFor(name),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

const ALLOWED_REMOTE = /^https:\/\/([a-z0-9-]+\.)*(wikimedia\.org|wikipedia\.org|wikidata\.org|image\.tmdb\.org|images\.igdb\.com|supabase\.co)\//i;

/** Downloads an image for the poster picker. Any https image works when the user pasted the link themselves. */
export async function fetchRemoteImage(url: string, userProvided: boolean): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  if (!userProvided && !ALLOWED_REMOTE.test(url)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await net.fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' }, signal: ctrl.signal });
    if (!res.ok) return null;
    const mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!mime.startsWith('image/')) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 25 * 1024 * 1024) return null;
    return { bytes: buf, mime };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
