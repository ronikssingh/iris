// Builds a throwaway Iris data folder for local testing (never shipped).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const out = process.argv[2];
const artifactDir = process.argv[3];
const opts = JSON.parse(process.argv[4] || '{}');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'Media'), { recursive: true });

const savePoster = (dataUrl) => {
  const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  const name = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 40) + '.jpg';
  fs.writeFileSync(path.join(out, 'Media', name), buf);
  return name;
};

const critiques = [];
if (artifactDir && fs.existsSync(artifactDir)) {
  for (const f of fs.readdirSync(artifactDir)) {
    const raw = JSON.parse(fs.readFileSync(path.join(artifactDir, f), 'utf8'));
    const d = raw.data ?? raw;
    critiques.push({
      id: d.id, title: d.title, type: d.type, director: d.director, studio: d.studio, cast: d.cast,
      description: d.description, comments: d.comments, scores: d.scores, scoreNotes: {},
      classOverride: d.clsManual ? d.cls : null, recommend: d.recommend === 'yes' ? 'yes' : d.recommend === 'no' ? 'no' : null,
      finalRemarks: d.finalRemarks, poster: d.poster ? savePoster(d.poster) : null, posterColor: null, year: '',
      createdAt: d.createdAt, updatedAt: d.updatedAt,
    });
  }
}
const mk = (title, type, base, extra = {}) => {
  const keys = ['story','screenplay','characters','acting','visuals','soundtrack','production','vision','pacing','enjoyment'];
  const scores = Object.fromEntries(keys.map((k, i) => [k, Math.max(0, Math.min(100, Math.round(base + Math.sin(i * 2.3 + title.length) * 7)))]));
  return { id: 'c' + crypto.randomBytes(5).toString('hex'), title, type, director: extra.director ?? '', studio: extra.studio ?? '', cast: extra.cast ?? '',
    description: extra.description ?? '', comments: extra.comments ?? '', scores, scoreNotes: {}, classOverride: null, recommend: extra.recommend ?? 'yes',
    finalRemarks: extra.finalRemarks ?? '', poster: null, posterColor: null, year: extra.year ?? '', createdAt: Date.now() - Math.random() * 9e9, updatedAt: Date.now() };
};
if (opts.extras) {
  critiques.push(
    mk('Dune: Part Two', 'movie', 95, { director: 'Denis Villeneuve', studio: 'Legendary Pictures', year: '2024', finalRemarks: 'Sand, scale and sound like nothing else.' }),
    mk('The Dark Knight', 'movie', 93, { director: 'Christopher Nolan', year: '2008' }),
    mk('Spider-Man: Across the Spider-Verse', 'movie', 92, { year: '2023' }),
    mk('Arcane', 'show', 94, { director: 'Christian Linke', year: '2021' }),
    mk('Breaking Bad', 'show', 91, { year: '2008' }),
    mk('Elden Ring', 'game', 90, { director: 'Hidetaka Miyazaki', studio: 'FromSoftware', year: '2022' }),
    mk('The Last of Us Part II', 'game', 86, { year: '2020' }),
    mk('Morbius', 'movie', 28, { recommend: 'no', year: '2022' }),
    mk('Some Okay Sitcom', 'show', 58, { recommend: 'no' }),
  );
}
const watchlist = opts.watch ? [
  { id: 'w1', title: 'Oppenheimer', type: 'movie', status: 'want', note: 'Rewatch in IMAX', poster: null, posterColor: null, year: '2023', director: 'Christopher Nolan', studio: '', cast: '', description: '', order: 0, addedAt: Date.now(), updatedAt: Date.now() },
  { id: 'w2', title: 'Shogun', type: 'show', status: 'watched', note: '', poster: null, posterColor: null, year: '2024', director: '', studio: '', cast: '', description: '', order: 0, addedAt: Date.now(), updatedAt: Date.now() },
  { id: 'w3', title: 'Hollow Knight: Silksong', type: 'game', status: 'want', note: 'Finally', poster: null, posterColor: null, year: '', director: '', studio: '', cast: '', description: '', order: 1, addedAt: Date.now(), updatedAt: Date.now() },
] : [];
const lib = { format: 'iris-library', schema: 1, critiques, watchlist, drafts: [], trash: [], meta: { createdAt: Date.now(), legacyCheckedAt: Date.now(), legacyImported: 0 } };
fs.writeFileSync(path.join(out, 'library.json'), JSON.stringify(lib));
const settings = { format: 'iris-settings', userName: 'Ronik', firstRunDone: opts.firstRun ? false : true, theme: opts.theme || 'winedark', autoRotate: false, rotateMinutes: 10, rotateOrder: 'random',
  sound: { enabled: false, volume: 0.7, intro: true, ui: true, ambience: true, ambienceVolume: 0.35 }, motion: 'full', intro: opts.intro || 'off',
  archive: { view: 'posters', groupBy: 'type', sort: [{ key: 'type', dir: 'asc' }, { key: 'rating', dir: 'desc' }] }, backup: { folder: null, keep: 12, lastFullBackupAt: null, remindDismissedAt: null } };
fs.writeFileSync(path.join(out, 'settings.json'), JSON.stringify(settings, null, 2));
console.log('test data at', out, 'critiques', critiques.length);
