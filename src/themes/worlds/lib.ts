/* Shared GLSL helpers for the worlds: shapes, extra noise, skies and light. */

export const WLIB = /* glsl */ `
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float sat1(float x){ return clamp(x, 0.0, 1.0); }
/* antialiased coverage of a signed distance, px = one pixel in the same units */
float af(float d, float px){ return clamp(0.5 - d / px, 0.0, 1.0); }
float sdCircle(vec2 p, float r){ return length(p) - r; }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float sdTaper(vec2 p, vec2 a, vec2 b, float ra, float rb){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(ra, rb, h); }
float sdEllipse(vec2 p, vec2 r){ float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2){
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)), vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))), vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float smax(float a, float b, float k){ return -smin(-a, -b, k); }

/* gradient noise, smoother than value noise for clouds and water */
vec2 ghash(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453123); }
float gnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(dot(ghash(i), f), dot(ghash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(ghash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(ghash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}
float fbm4(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++){ v += a * vnoise(p); p = FBM_M * p; a *= 0.5; } return v; }
float fbm6(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 6; i++){ v += a * vnoise(p); p = FBM_M * p; a *= 0.5; } return v; }
float gfbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a * gnoise(p); p = FBM_M * p; a *= 0.5; } return v; }
/* distance to the nearest feature point, and that cell's random id */
vec2 voronoi(vec2 x){
  vec2 n = floor(x), f = fract(x);
  float md = 8.0; float id = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash22(n + g);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md){ md = d; id = hash21(n + g); }
  }
  return vec2(sqrt(md), id);
}
/* twinkling stars; scale = cells per unit, thresh = how rare */
vec3 starfield(vec2 p, float scale, float thresh, float t, float px){
  vec2 g = p * scale; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float h = hash21(id);
  if (h < thresh) return vec3(0.0);
  vec2 o = (hash22(id + 7.0) - 0.5) * 0.7;
  float d = length(f - o) / scale;
  float b = (h - thresh) / (1.0 - thresh);
  float tw = 0.65 + 0.35 * sin(t * (1.0 + h * 5.0) + h * 40.0);
  float core = exp(-d * d / (px * px * (0.6 + b * 1.6)));
  vec3 tint = mix(vec3(1.0, 0.86, 0.74), vec3(0.74, 0.84, 1.0), hash21(id + 3.1));
  return tint * core * b * b * tw * 1.6;
}
/* 1D noise for skylines and ridges, far cheaper than the 2D kind */
float n1(float x){ float i = floor(x); float f = fract(x); return mix(hash11(i), hash11(i + 1.0), f * f * (3.0 - 2.0 * f)); }
float fbm1(float x){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a * n1(x); x = x * 2.03 + 17.1; a *= 0.5; } return v; }
float fbm1lo(float x){ return 0.5714 * (n1(x) + 0.5 * n1(x * 2.03 + 17.1) + 0.25 * n1(x * 4.12 + 51.8)); }
float ridge1(float x){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ float n = 1.0 - abs(n1(x) * 2.0 - 1.0); v += a * n * n; x = x * 2.07 + 31.7; a *= 0.5; } return v; }
/* a row of conifers standing on a ridge: returns a signed distance-like value (negative inside) */
float pineRow(vec2 p, float ground, float spacing, float hMin, float hMax, float seed){
  float c = floor(p.x / spacing);
  float d = 1e5;
  for (int k = -1; k <= 1; k++){
    float id = c + float(k);
    float r = hash11(id * 1.37 + seed);
    float cx = (id + 0.25 + 0.5 * hash11(id * 3.11 + seed)) * spacing;
    float th = mix(hMin, hMax, r) * (0.55 + 0.45 * n1(cx * 31.0 / hMax * 0.02 + seed));
    float tip = ground + th;
    float y = (tip - p.y) / th;                       // 0 at the tip, 1 at the ground
    float ty = y * (5.0 + r * 3.0) + r * 3.7;
    float tier = fract(ty + 0.35 * sin(floor(ty) * 2.3 + id));
    float br = hash11(floor(y * 23.0) + id * 7.0);
    float w = th * (0.025 + 0.15 * y) * (0.80 + 0.28 * tier) * (0.84 + 0.30 * br);
    float dt = max(abs(p.x - cx) - w, max(p.y - tip, ground - 0.02 - p.y));
    d = min(d, dt);
  }
  return d;
}
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 saturate3(vec3 c, float s){ return mix(vec3(luma(c)), c, s); }
/* filmic curve with gentle shoulder, keeps bright light glowing instead of clipping */
vec3 filmic(vec3 x){ x = max(x, 0.0); return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
/* split-tone grade: tint shadows and highlights separately */
vec3 grade(vec3 c, vec3 shadows, vec3 highs, float amt){ float l = luma(c); return mix(c, c * mix(shadows, highs, smoothstep(0.0, 0.7, l)), amt); }
`;
