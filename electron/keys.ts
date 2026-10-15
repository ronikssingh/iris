/* Keys for the online catalogues. They are added when GitHub builds the app (from the repository's
   secrets) and never live in the source code. Environment variables override them for local builds. */
declare const __IRIS_KEYS__: { tmdb?: string; igdbId?: string; igdbSecret?: string } | undefined;

const built = typeof __IRIS_KEYS__ !== 'undefined' && __IRIS_KEYS__ ? __IRIS_KEYS__ : {};

export const KEYS = {
  tmdb: process.env.TMDB_TOKEN || built.tmdb || '',
  igdbId: process.env.IGDB_CLIENT_ID || built.igdbId || '',
  igdbSecret: process.env.IGDB_CLIENT_SECRET || built.igdbSecret || '',
};
