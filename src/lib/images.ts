/* Poster handling: shrink incoming images, find their dominant colour, store them through the main process. */

export const mediaUrl = (name: string | null | undefined): string | null => (name ? `iris-media://m/${name}` : null);

/* Pictures whose address came from someone else (a friend's critique, a suggestion, a profile) are shown or
   downloaded only from the catalogues' image servers and this app's own storage, never from anywhere a stranger
   chooses. */
const OWN_STORAGE = (() => {
  const u = (typeof __SUPABASE__ !== 'undefined' ? __SUPABASE__.url : '').trim().replace(/\/+$/, '');
  return u ? u + '/storage/v1/object/public/' : null;
})();
const CATALOGUE_IMAGES = /^https:\/\/(image\.tmdb\.org|images\.igdb\.com|upload\.wikimedia\.org)\//;

export function trustedImageUrl(url: string | null | undefined, only?: 'avatars'): string | null {
  if (!url) return null;
  if (url.startsWith('blob:')) return url;
  if (OWN_STORAGE && url.startsWith(OWN_STORAGE + (only ? only + '/' : ''))) return url;
  if (!only && CATALOGUE_IMAGES.test(url)) return url;
  return null;
}

const MAX_W = 720;
const MAX_H = 1080;

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

/** A vivid but not garish colour that represents the image; used for glows and backdrops. */
export function dominantColor(src: CanvasImageSource, w: number, h: number): string {
  const c = document.createElement('canvas');
  const cw = 24;
  const ch = Math.max(8, Math.round((24 * h) / Math.max(1, w)));
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(src, 0, 0, cw, ch);
  let data: Uint8ClampedArray;
  try {
    data = g.getImageData(0, 0, cw, ch).data;
  } catch {
    return '#7a6a58';
  }
  let r = 0, gg = 0, b = 0, wsum = 0;
  let ar = 0, ag = 0, ab = 0;
  for (let i = 0; i < data.length; i += 4) {
    const R = data[i], G = data[i + 1], B = data[i + 2];
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    const l = (max + min) / 510;
    const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    const wgt = s * s * (1 - Math.abs(l - 0.5) * 1.6) + 0.002;
    r += R * wgt;
    gg += G * wgt;
    b += B * wgt;
    wsum += wgt;
    ar += R;
    ag += G;
    ab += B;
  }
  const n = data.length / 4;
  if (wsum < 0.05) return toHex(ar / n, ag / n, ab / n);
  return toHex(r / wsum, gg / wsum, b / wsum);
}

/** Decodes any browser-readable image, scales it to poster size and re-encodes it as JPEG. */
export async function processImage(input: Blob): Promise<{ bytes: Uint8Array; ext: 'jpg' | 'png'; color: string }> {
  const bmp = await createImageBitmap(input);
  const scale = Math.min(1, MAX_W / bmp.width, MAX_H / bmp.height);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  const color = dominantColor(canvas, w, h);
  bmp.close?.();
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode image'))), 'image/jpeg', 0.88));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: 'jpg', color };
}

export async function savePoster(input: Blob): Promise<{ name: string; color: string }> {
  const { bytes, ext, color } = await processImage(input);
  const name = await window.iris.media.save(bytes, ext);
  return { name, color };
}

/** Downloads a poster. pasted: the person typed or pasted this link themselves, so any web address is fine. */
export async function savePosterFromUrl(url: string, pasted = false): Promise<{ name: string; color: string } | null> {
  if (!pasted && !trustedImageUrl(url)) return null;
  const r = await window.iris.media.fetchRemote(url, pasted);
  if (!r) return null;
  const blob = new Blob([r.bytes as BlobPart], { type: r.mime || 'image/jpeg' });
  return savePoster(blob);
}

/** Works out the colour of an already-stored poster (used for posters imported without one). */
export function colorOfStored(name: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(dominantColor(img, img.naturalWidth, img.naturalHeight));
    img.onerror = () => resolve(null);
    img.src = mediaUrl(name)!;
  });
}

export function firstImageFile(list: FileList | DataTransferItemList | null | undefined): File | null {
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const it: any = (list as any)[i];
    const f: File | null = it instanceof File ? it : it?.kind === 'file' ? it.getAsFile() : null;
    if (f && /^image\//.test(f.type)) return f;
  }
  return null;
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [128, 128, 128];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
