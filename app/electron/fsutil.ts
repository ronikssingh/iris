import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Write a file so that a crash mid-write can never leave a half-written file behind. */
export async function writeFileAtomic(file: string, data: string | Uint8Array, keepBackup = false): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  const fh = await fsp.open(tmp, 'w');
  try {
    await fh.writeFile(data);
    await fh.sync();
  } finally {
    await fh.close();
  }
  if (keepBackup && (await exists(file))) {
    try {
      await fsp.copyFile(file, file + '.bak');
    } catch {
      /* a missing backup copy is not worth failing the save over */
    }
  }
  await fsp.rename(tmp, file);
}

export function sha256(data: Uint8Array | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function readJson<T = unknown>(file: string): Promise<T> {
  const txt = await fsp.readFile(file, 'utf8');
  return JSON.parse(txt) as T;
}

export function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function humanStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await fsp.cp(src, dest, { recursive: true, force: true, errorOnExist: false });
}

export function existsSync(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/** Serialises async jobs so file writes never overlap; only the newest pending job runs. */
export class LatestWriter<T> {
  private running = false;
  private pending: T | null = null;
  private waiters: Array<(r: { ok: boolean; error?: string }) => void> = [];
  constructor(private readonly job: (value: T) => Promise<void>) {}

  write(value: T): Promise<{ ok: boolean; error?: string }> {
    this.pending = value;
    const p = new Promise<{ ok: boolean; error?: string }>((res) => this.waiters.push(res));
    if (!this.running) void this.loop();
    return p;
  }

  private async loop() {
    this.running = true;
    while (this.pending !== null) {
      const v = this.pending;
      this.pending = null;
      const waiters = this.waiters;
      this.waiters = [];
      let result: { ok: boolean; error?: string } = { ok: true };
      try {
        await this.job(v);
      } catch (e: any) {
        result = { ok: false, error: e?.message || String(e) };
      }
      for (const w of waiters) w(result);
    }
    this.running = false;
  }

  async idle(): Promise<void> {
    while (this.running) await new Promise((r) => setTimeout(r, 20));
  }
}
