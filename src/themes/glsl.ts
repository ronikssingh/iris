/* GLSL for the living backgrounds and the transitions between them. */
import type { ThemeId } from '../shared/settings';
import { WLIB } from './worlds/lib';
import { moonwake } from './worlds/moonwake';
import { sundown } from './worlds/sundown';
import { lanternmere } from './worlds/lanternmere';
import { gloamwood } from './worlds/gloamwood';
import { velocity } from './worlds/velocity';
import { fimbulwinter } from './worlds/fimbulwinter';

export const VERT = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const NOISE = /* glsl */ `
#define PI 3.14159265
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
const mat2 FBM_M = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = FBM_M * p; a *= 0.5; } return v; }
float fbm3(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 3; i++){ v += a * vnoise(p); p = FBM_M * p; a *= 0.5; } return v; }
float ridge(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ float n = 1.0 - abs(vnoise(p) * 2.0 - 1.0); v += a * n * n; p = FBM_M * p; a *= 0.5; } return v; }
`;

const COMMON = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uFlash;
uniform vec2 uFlashPos;
uniform float uVig;
out vec4 fragColor;
${NOISE}
vec3 tonemap(vec3 c){ return clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0); }
`;

const MAIN = /* glsl */ `
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = scene(uv);
  vec2 d = uv - 0.5;
  c *= 1.0 - uVig * dot(d, d) * 1.9;
  c += (hash21(gl_FragCoord.xy + fract(uTime * 7.13) * 91.0) - 0.5) / 150.0;
  fragColor = vec4(max(c, 0.0), 1.0);
}`;

/* ---------------------------------------------------------------- Vigil */
const vigil = /* glsl */ `
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 m = uMouse * 0.012;
  float hz = 0.34;
  vec3 col = mix(vec3(0.21, 0.06, 0.035), vec3(0.012, 0.015, 0.024), smoothstep(hz - 0.06, 0.92, uv.y));
  vec2 cp = vec2(uv.x * asp * 1.25 + uTime * 0.011, uv.y * 2.3 - uTime * 0.003);
  float cl = fbm(cp + fbm(cp * 0.7 + uTime * 0.008) * 1.3);
  float cloudMask = smoothstep(0.32, 0.8, cl) * smoothstep(0.26, 0.58, uv.y);
  vec3 cloudCol = mix(vec3(0.05, 0.05, 0.065), vec3(0.34, 0.1, 0.055), smoothstep(0.98, 0.32, uv.y) * (0.6 + 0.4 * cl));
  col = mix(col, cloudCol, cloudMask * 0.92);
  col *= 1.0 - smoothstep(0.55, 1.0, uv.y) * (1.0 - cloudMask) * 0.5;
  float fd = exp(-length((uv - uFlashPos) * vec2(asp, 1.0)) * 2.3);
  col += vec3(0.56, 0.63, 0.86) * uFlash * (0.25 + fd * 1.7) * smoothstep(0.25, 0.75, uv.y + cl * 0.35);
  for (int i = 0; i < 2; i++){
    float fi = float(i);
    vec2 o = vec2(0.26 + fi * 0.5 + m.x, hz - 0.04);
    float ang = 0.42 * sin(uTime * (0.06 + fi * 0.025) + fi * 2.1) + (fi - 0.5) * 0.45;
    vec2 d = (uv - o) * vec2(asp, 1.0);
    float a = atan(d.x, d.y) - ang;
    float beam = exp(-abs(a) * 34.0) * smoothstep(0.0, 0.12, d.y) * exp(-length(d) * 1.05);
    col += vec3(0.78, 0.64, 0.48) * beam * (0.18 + cloudMask * 0.9);
  }
  col += vec3(0.36, 0.085, 0.03) * exp(-abs(uv.y - hz) * 8.0) * 0.55;
  for (int L = 0; L < 3; L++){
    float fl = float(L);
    float scale = 26.0 - fl * 7.0;
    float x = (uv.x + m.x * (0.5 + fl * 0.8)) * scale * asp / 1.6 + fl * 37.0;
    float id = floor(x);
    float fx = fract(x);
    float h = hz - 0.12 + (0.04 + 0.13 * hash11(id * 1.37 + fl * 11.0)) * (0.7 + fl * 0.3);
    h += step(0.9, hash11(id * 3.1 + fl)) * (0.05 + 0.02 * fl);
    float top = h - step(0.55, hash11(id * 7.7)) * step(0.28, abs(fx - 0.5)) * 0.025;
    float gap = step(0.035, fx) * step(fx, 0.965);
    float inside = step(uv.y, top) * gap;
    float ant = step(0.86, hash11(id * 5.3 + fl)) * step(abs(fx - 0.5), 0.01) * step(uv.y, top + 0.045) * step(top, uv.y);
    inside = max(inside, ant);
    vec3 bcol = mix(vec3(0.07, 0.045, 0.045), vec3(0.006, 0.007, 0.01), fl / 2.0);
    vec2 w = vec2(fx * (6.0 - fl), uv.y * (120.0 - fl * 30.0));
    vec2 wid = floor(w);
    vec2 wf = fract(w);
    float bOn = step(0.32, hash11(id * 9.1 + fl * 2.0));
    float lit = bOn * step(0.86 - fl * 0.02, hash21(wid + id * 13.1)) * step(0.22, wf.x) * step(wf.x, 0.78) * step(0.28, wf.y) * step(wf.y, 0.8);
    float flick = 0.78 + 0.22 * sin(uTime * (0.7 + hash21(wid) * 2.5) + hash21(wid + 3.0) * 6.28);
    vec3 wcol = mix(vec3(1.0, 0.74, 0.4), vec3(0.95, 0.34, 0.16), hash21(wid * 1.7));
    vec3 layerCol = bcol + wcol * lit * flick * (0.2 + fl * 0.12) * step(uv.y, top - 0.008);
    layerCol = mix(layerCol, vec3(0.17, 0.055, 0.035), (2.0 - fl) * 0.24);
    layerCol += vec3(0.6, 0.65, 0.85) * uFlash * 0.05 * (2.0 - fl);
    col = mix(col, layerCol, inside);
  }
  float fog = fbm(vec2(uv.x * 2.6 * asp + uTime * 0.025, uv.y * 3.5));
  col += vec3(0.2, 0.065, 0.04) * smoothstep(0.34, 0.0, uv.y) * fog * 0.9;
  col += vec3(0.5, 0.55, 0.7) * uFlash * 0.06;
  return col;
}`;

/* --------------------------------------------------------------- Skyward */
const skyward = /* glsl */ `
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  vec2 sun = vec2(0.42 * asp * 0.5, 0.3) + uMouse * vec2(0.035, 0.025);
  vec3 zen = vec3(0.11, 0.38, 0.86);
  vec3 hor = vec3(0.72, 0.87, 1.0);
  vec3 col = mix(hor, zen, pow(smoothstep(-0.05, 1.0, uv.y), 0.75));
  float d = length(p - sun);
  col += vec3(1.0, 0.85, 0.55) * exp(-d * 3.0) * 0.5;
  col += vec3(1.0, 0.96, 0.86) * exp(-d * 13.0) * 1.1;
  col = mix(col, vec3(1.0, 1.0, 0.97), smoothstep(0.06, 0.05, d));
  float ang = atan(p.y - sun.y, p.x - sun.x);
  float rays = fbm3(vec2(ang * 5.0, uTime * 0.04));
  col += vec3(1.0, 0.9, 0.66) * pow(rays, 3.0) * exp(-d * 1.5) * 0.55;
  for (int i = 0; i < 2; i++){
    float fi = float(i);
    vec2 cp = vec2(p.x * (1.5 - fi * 0.45) + uTime * (0.007 + fi * 0.011), p.y * (2.5 - fi * 0.5) + fi * 3.0);
    cp += uMouse * 0.04 * (fi + 1.0);
    float c = fbm(cp + vec2(fbm(cp * 1.3 + uTime * 0.008), 0.0));
    float band = fi < 0.5
      ? smoothstep(-0.05, 0.22, p.y) * smoothstep(0.62, 0.25, p.y)
      : smoothstep(-0.58, -0.2, p.y) * smoothstep(0.12, -0.28, p.y);
    float cov = smoothstep(0.46, 0.8, c) * band;
    float c2 = fbm(cp + normalize(sun - p) * 0.09 + vec2(fbm(cp * 1.3 + uTime * 0.008), 0.0));
    float lit = clamp(0.55 + (c - c2) * 4.5, 0.0, 1.0);
    vec3 cc = mix(vec3(0.62, 0.71, 0.86), vec3(1.0, 0.985, 0.95), lit);
    cc += vec3(1.0, 0.82, 0.5) * exp(-length(p - sun) * 2.4) * 0.45 * (1.0 - cov * 0.5);
    col = mix(col, cc, cov * (0.94 - fi * 0.12));
  }
  vec2 dir = -sun;
  for (int k = 1; k < 5; k++){
    float fk = float(k);
    vec2 gp = sun + dir * (fk * 0.42);
    float gd = length(p - gp);
    vec3 gc = mix(vec3(0.55, 0.78, 1.0), vec3(1.0, 0.72, 0.5), fract(fk * 0.37));
    col += gc * smoothstep(0.045 + fk * 0.018, 0.0, gd) * 0.07;
  }
  col += vec3(1.0, 0.9, 0.7) * exp(-abs(uv.y - 0.02) * 6.0) * 0.12;
  return col;
}`;

/* ---------------------------------------------------------------- Mirage */
const mirage = /* glsl */ `
float duneH(float x, float seed, float amp){
  float n = fbm3(vec2(x * 0.8 + seed, seed * 1.7));
  float r = pow(1.0 - abs(sin(x * 1.2 + n * 3.0 + seed)), 1.6);
  return n * amp + r * amp * 0.34;
}
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float hz = 0.44;
  vec3 col = mix(vec3(1.0, 0.8, 0.54), vec3(0.46, 0.15, 0.06), smoothstep(hz, 0.98, uv.y));
  col = mix(col, vec3(0.2, 0.055, 0.025), smoothstep(0.72, 1.1, uv.y));
  float haze = sin(uv.y * 170.0 + uTime * 3.0) * 0.0022 * smoothstep(0.62, hz, uv.y);
  vec2 sp = p + vec2(haze, 0.0);
  vec2 sun = vec2(0.27 * asp * 0.62 + uMouse.x * 0.025, hz - 0.5 + 0.16 + uMouse.y * 0.008);
  float d = length(sp - sun);
  col += vec3(1.0, 0.62, 0.28) * exp(-d * 2.1) * 0.62;
  col = mix(col, vec3(1.0, 0.94, 0.8), smoothstep(0.17, 0.164, d));
  float dust = fbm(vec2(p.x * 1.8 - uTime * 0.045, p.y * 3.0));
  col = mix(col, vec3(0.96, 0.66, 0.4), dust * 0.24 * smoothstep(1.0, hz, uv.y));
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    float amp = 0.055 + fi * 0.035;
    float x = p.x * (1.3 + fi * 0.55) + uMouse.x * (0.04 + fi * 0.09) + fi * 13.7 + uTime * 0.0015 * (fi + 1.0);
    float base = hz - 0.035 - fi * 0.088;
    float h = base + duneH(x, fi * 3.1, amp);
    if (uv.y < h){
      float e = 0.012;
      float depth = h - uv.y;
      float xs = x - depth * (2.2 + fi * 0.6);
      float slope = (duneH(xs + e, fi * 3.1, amp) - duneH(xs - e, fi * 3.1, amp)) / (2.0 * e);
      float light = clamp(0.58 + slope * 1.6, 0.0, 1.0);
      light = mix(0.5, light, exp(-depth * 6.0) * 0.75 + 0.25);
      vec3 sand = mix(vec3(0.42, 0.17, 0.07), vec3(0.99, 0.69, 0.41), light);
      sand *= mix(0.6, 1.0, smoothstep(h - 0.28, h, uv.y));
      float rip = sin(x * 46.0 + uv.y * 300.0 + fbm3(vec2(x * 4.0, uv.y * 20.0)) * 4.0) * 0.5 + 0.5;
      sand *= 0.94 + rip * 0.06 * (fi / 3.0);
      sand += vec3(1.0, 0.7, 0.4) * smoothstep(h - 0.006, h, uv.y) * light * 0.25;
      sand = mix(sand, vec3(1.0, 0.79, 0.56), (3.0 - fi) * 0.15);
      col = sand;
    }
  }
  float sheet = fbm(vec2(p.x * 2.6 - uTime * 0.55, uv.y * 16.0));
  col += vec3(1.0, 0.76, 0.46) * smoothstep(0.55, 0.9, sheet) * smoothstep(hz, 0.0, uv.y) * 0.16;
  return col;
}`;

/* ------------------------------------------------------------ Glitch Pop */
const glitchpop = /* glsl */ `
vec3 pal(float t){
  vec3 a = vec3(1.0, 0.18, 0.53);
  vec3 b = vec3(0.0, 0.88, 1.0);
  vec3 c = vec3(1.0, 0.9, 0.05);
  vec3 d = vec3(0.42, 0.17, 1.0);
  t = fract(t) * 4.0;
  if (t < 1.0) return mix(d, a, t);
  if (t < 2.0) return mix(a, c, t - 1.0);
  if (t < 3.0) return mix(c, b, t - 2.0);
  return mix(b, d, t - 3.0);
}
float halftone(vec2 fc, float angle, float cell, float v){
  float s = sin(angle); float c = cos(angle);
  vec2 q = mat2(c, -s, s, c) * fc / cell;
  vec2 f = fract(q) - 0.5;
  float r = sqrt(clamp(v, 0.0, 1.0)) * 0.62;
  return smoothstep(r + 0.07, r - 0.07, length(f));
}
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float g = uFlash;
  float band = floor(uv.y * 26.0 + floor(uTime * 14.0));
  p.x += (hash11(band) - 0.5) * 0.14 * g * step(0.55, hash11(band + 7.0));
  vec2 q = p * 1.15;
  float n1 = fbm(q + vec2(uTime * 0.045, -uTime * 0.03));
  float n2 = fbm(q * 1.6 + n1 * 1.6 - uTime * 0.035);
  vec3 base = pal(n2 * 1.25 + uTime * 0.018);
  vec3 col = mix(vec3(0.075, 0.03, 0.17), base, smoothstep(0.28, 0.74, n2) * 0.95);
  vec2 fc = gl_FragCoord.xy;
  float cs = uRes.y / 760.0;
  float lum = dot(col, vec3(0.3, 0.5, 0.2));
  float md = length((uv - (uMouse * 0.5 + 0.5)) * vec2(asp, 1.0));
  float boost = exp(-md * 5.0) * 0.55;
  float h1 = halftone(fc, 0.26, 9.0 * cs, n1 * 0.85 + boost);
  float h2 = halftone(fc + 3.0, 1.31, 12.0 * cs, (1.0 - lum) * 0.75 + boost * 0.5);
  col = mix(col, vec3(1.0, 0.16, 0.55), h1 * 0.34);
  col = mix(col, vec3(0.04, 0.88, 1.0), h2 * 0.22 * smoothstep(0.3, 0.8, n1));
  float k = (p.x * 0.8 + p.y * 0.35) * 1.3 + 0.13;
  float lines = abs(fract(k) - 0.5);
  float panel = smoothstep(0.014, 0.005, lines) * step(0.45, hash11(floor(k)));
  col = mix(col, vec3(0.04, 0.02, 0.1), panel * 0.9);
  float spray = step(0.9962, hash21(floor(fc / (3.0 * cs)) + floor(uTime * 2.0))) * smoothstep(0.4, 0.9, n2);
  col = mix(col, vec3(1.0, 0.95, 0.25), spray);
  col.r += g * 0.28 * step(0.5, hash11(band + 3.0));
  col.b += g * 0.28 * step(0.5, hash11(band + 5.0));
  col.g += g * 0.12 * step(0.7, hash11(band + 9.0));
  return col;
}`;

/* ---------------------------------------------------------- Wine-Dark Sea */
const winedark = /* glsl */ `
float wave(vec2 p, float t){
  float h = 0.0;
  h += sin(dot(p, vec2(0.8, 0.6)) * 1.0 + t * 1.15) * 0.30;
  h += sin(dot(p, vec2(-0.55, 0.83)) * 1.7 + t * 1.55) * 0.17;
  h += sin(dot(p, vec2(0.95, -0.3)) * 2.9 + t * 2.05) * 0.08;
  h += sin(dot(p, vec2(0.2, 1.0)) * 4.7 + t * 2.7) * 0.045;
  h += (fbm3(p * 1.5 + vec2(t * 0.22, t * 0.14)) - 0.5) * 0.34;
  return h;
}
vec3 skyCol(vec3 rd, vec3 sunDir){
  float y = max(rd.y, 0.0);
  vec3 c = mix(vec3(0.24, 0.19, 0.19), vec3(0.03, 0.05, 0.07), pow(y, 0.45));
  float s = max(dot(rd, sunDir), 0.0);
  c += vec3(1.0, 0.7, 0.34) * pow(s, 7.0) * 0.45 + vec3(1.0, 0.86, 0.55) * pow(s, 160.0) * 2.2;
  return c;
}
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float hz = 0.4 + uMouse.y * 0.008 + sin(uTime * 0.33) * 0.004;
  vec2 sun = vec2(0.66 + uMouse.x * 0.025, 0.62);
  vec3 sunDir = normalize(vec3((sun.x - 0.5) * asp, sun.y - hz, 1.25));
  vec3 col;
  if (uv.y > hz){
    vec2 cp = vec2(uv.x * asp * 1.15 + uTime * 0.009, (uv.y - hz) * 2.5);
    float c = fbm(cp + fbm(cp * 0.8 - uTime * 0.011) * 1.4);
    col = mix(vec3(0.2, 0.15, 0.15), vec3(0.025, 0.05, 0.07), smoothstep(hz, 1.0, uv.y));
    col = mix(col, vec3(0.012, 0.028, 0.038), smoothstep(0.42, 0.82, c));
    vec2 dv = (uv - sun) * vec2(asp, 1.0);
    float ds = length(dv);
    float gap = smoothstep(0.58, 0.26, c) * exp(-ds * 2.0);
    col += vec3(1.0, 0.7, 0.3) * gap * 0.95;
    col += vec3(1.0, 0.8, 0.45) * exp(-ds * 7.0) * 0.4;
    float ang = atan(dv.x, -dv.y);
    float rays = fbm3(vec2(ang * 9.0, uTime * 0.025));
    col += vec3(0.92, 0.64, 0.3) * pow(rays, 4.0) * smoothstep(0.0, -0.45, dv.y) * exp(-ds * 1.15) * 1.1;
    float fd = exp(-length((uv - uFlashPos) * vec2(asp, 1.0)) * 3.0);
    col += vec3(0.62, 0.72, 0.92) * uFlash * (0.22 + fd * 1.5) * (1.0 - smoothstep(0.3, 0.7, c) * 0.45);
    col = mix(col, vec3(0.26, 0.22, 0.21), exp(-(uv.y - hz) * 16.0) * 0.65);
  } else {
    vec3 rd = normalize(vec3(p.x, uv.y - hz - 0.002, 1.25));
    float t = -1.35 / rd.y;
    vec2 wp = vec2(rd.x * t, rd.z * t) * 0.36 + vec2(0.0, uTime * 0.32);
    float e = 0.012 + 0.0025 * t;
    float h0 = wave(wp, uTime);
    float hx = wave(wp + vec2(e, 0.0), uTime);
    float hy = wave(wp + vec2(0.0, e), uTime);
    vec3 n = normalize(vec3(-(hx - h0), e * 2.4, -(hy - h0)));
    n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(8.0, 46.0, t)));
    vec3 R = reflect(rd, n);
    float fres = 0.05 + 0.95 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
    vec3 water = mix(vec3(0.025, 0.12, 0.14), vec3(0.11, 0.035, 0.07), smoothstep(-0.3, 0.45, h0));
    col = mix(water, skyCol(R, sunDir), fres);
    col += vec3(0.04, 0.16, 0.15) * smoothstep(0.15, 0.6, h0) * 0.7;
    float foam = smoothstep(0.42, 0.72, h0 + (fbm3(wp * 6.0) - 0.5) * 0.45);
    col = mix(col, vec3(0.68, 0.72, 0.72), foam * 0.3 * smoothstep(40.0, 5.0, t));
    col += vec3(0.6, 0.7, 0.9) * uFlash * 0.25 * fres;
    col = mix(col, vec3(0.25, 0.21, 0.2), smoothstep(12.0, 70.0, t));
  }
  return col;
}`;

/* ---------------------------------------------------------- Fimbulwinter */
/* --------------------------------------------------------- Event Horizon */
const eventhorizon = /* glsl */ `
vec3 stars(vec2 q){
  vec3 s = vec3(0.0);
  for (int l = 0; l < 3; l++){
    float fl = float(l);
    vec2 g = q * (55.0 + fl * 70.0) + fl * 13.0;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash21(id);
    if (h > 0.965 - fl * 0.012){
      vec2 o = (hash22(id) - 0.5) * 0.7;
      float d = length(f - o);
      float b = (h - 0.95) * 18.0;
      float tw = 0.7 + 0.3 * sin(uTime * (1.5 + h * 4.0) + h * 30.0);
      vec3 sc = mix(vec3(1.0, 0.86, 0.72), vec3(0.72, 0.82, 1.0), hash21(id + 4.0));
      s += sc * smoothstep(0.14, 0.0, d) * b * tw;
    }
  }
  return s;
}
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  vec2 c = vec2(min(asp, 1.9) * 0.22, 0.15) + uMouse * vec2(0.025, 0.018);
  vec2 d = p - c;
  float r = length(d);
  float R = 0.12;
  vec2 lens = d * (1.0 - (R * R * 1.8) / max(r * r, 0.0004));
  vec2 q = c + lens + vec2(uTime * 0.0018, 0.0);
  vec3 col = vec3(0.0);
  float neb = fbm(q * 1.3 + 10.0);
  col += vec3(0.09, 0.11, 0.24) * pow(neb, 2.2) * 0.95 + vec3(0.24, 0.11, 0.04) * pow(fbm(q * 1.9 - 5.0), 3.0) * 0.65;
  col += stars(q);
  float hole = smoothstep(R * 0.96, R * 1.03, r);
  col *= hole;
  // photon ring
  col += vec3(1.0, 0.86, 0.66) * exp(-abs(r - R * 1.06) * 150.0) * 1.5;
  // lensed image of the far side of the disk, arching over and under the shadow
  float aAng = atan(d.y, d.x);
  float arcN = fbm(vec2(aAng * 3.0 + uTime * 0.35, r * 22.0));
  float arc = exp(-abs(r - R * 1.42) * 22.0) * (0.55 + 0.6 * arcN) * smoothstep(0.0, 0.5, abs(d.y) / max(r, 0.001));
  col += vec3(1.0, 0.72, 0.4) * arc * hole * (0.65 + 0.35 * smoothstep(1.0, -1.0, d.x / max(r, 0.001)));
  // the accretion disk, seen almost edge-on
  float tilt = 0.08;
  mat2 rot = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt));
  vec2 dd = rot * d;
  vec2 e = vec2(dd.x, dd.y / 0.15);
  float er = length(e);
  float ea = atan(e.y, e.x);
  float inner = R * 1.65;
  float outer = R * 5.2;
  float ring = smoothstep(inner, inner * 1.12, er) * smoothstep(outer, outer * 0.5, er);
  float turb = fbm(vec2(er * 11.0 - uTime * 0.35, ea * 3.0 + uTime * 0.45));
  float beam = 0.4 + 0.6 * smoothstep(0.9, -0.9, cos(ea));
  vec3 dcol = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.93, 0.78), smoothstep(outer, inner, er));
  vec3 disk = dcol * (0.45 + turb * 1.1) * beam * ring * 1.9;
  float nearSide = dd.y < 0.0 ? 1.0 : hole;
  col += disk * nearSide;
  col += vec3(1.0, 0.6, 0.3) * exp(-r * 5.0) * 0.1 * hole;
  return col;
}`;

/* -------------------------------------------------------- Midnight Drive */
const midnightdrive = /* glsl */ `
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float hz = 0.4;
  vec3 col;
  if (uv.y >= hz){
    float t = (uv.y - hz) / (1.0 - hz);
    col = mix(vec3(0.96, 0.3, 0.46), vec3(0.22, 0.05, 0.4), smoothstep(0.0, 0.55, t));
    col = mix(col, vec3(0.035, 0.008, 0.11), smoothstep(0.45, 1.0, t));
    vec2 g = gl_FragCoord.xy / (1.4 * uRes.y / 900.0);
    vec2 sid = floor(g / 3.0);
    float h = hash21(sid);
    vec2 sf = fract(g / 3.0) - 0.5;
    col += vec3(1.0, 0.85, 1.0) * step(0.993, h) * smoothstep(0.3, 0.0, length(sf)) * smoothstep(0.3, 0.9, t) * (0.6 + 0.4 * sin(uTime * 3.0 + h * 50.0));
    vec2 sd = (uv - vec2(0.6 + uMouse.x * 0.015, hz + 0.17)) * vec2(asp, 1.0);
    float sr = length(sd);
    float R = 0.2;
    vec3 sunCol = mix(vec3(1.0, 0.24, 0.56), vec3(1.0, 0.86, 0.32), smoothstep(-R, R, sd.y));
    float gw = clamp(-sd.y / R, 0.0, 1.0) * 0.55;
    float gaps = step(gw, fract(sd.y * 22.0 - uTime * 0.22));
    float sunMask = smoothstep(R, R - 0.004, sr) * gaps;
    col = mix(col, sunCol, sunMask);
    col += vec3(1.0, 0.3, 0.6) * exp(-max(sr - R, 0.0) * 8.0) * 0.35;
    float mx = p.x * 2.1 + uMouse.x * 0.07;
    float side = smoothstep(0.12, 0.55, abs(p.x));
    float mh = hz + 0.015 + ridge(vec2(mx * 1.3, 3.0)) * 0.15 * side;
    float mt = smoothstep(mh, mh - 0.003, uv.y);
    float edge = exp(-abs(uv.y - mh) * 380.0) * side;
    col = mix(col, vec3(0.08, 0.02, 0.18), mt);
    col += vec3(1.0, 0.3, 0.8) * edge * 0.9;
  } else {
    float dy = hz - uv.y;
    float z = 0.25 / dy;
    float x = p.x * z * 2.2 + uMouse.x * 0.35;
    float zz = z * 3.0 + uTime * 2.0;
    float lx = abs(fract(x) - 0.5);
    float lz = abs(fract(zz) - 0.5);
    float w = 0.012 * z;
    float gx = smoothstep(w + 0.02, w, lx);
    float gz = smoothstep(w * 0.6 + 0.02, w * 0.6, lz);
    float fade = exp(-z * 0.05);
    col = vec3(0.045, 0.0, 0.1) + vec3(1.0, 0.24, 0.72) * (gx + gz) * fade * 1.3;
    col += vec3(1.0, 0.2, 0.7) * (exp(-lx * 30.0 / max(z * 0.15, 0.2)) + exp(-lz * 30.0)) * 0.08 * fade;
    col += vec3(1.0, 0.45, 0.4) * exp(-abs(p.x - 0.1 * asp - uMouse.x * 0.015) * 4.0) * exp(-dy * 6.0) * 0.5;
    col += vec3(1.0, 0.3, 0.6) * exp(-dy * 30.0) * 0.8;
  }
  col *= 0.95 + 0.05 * sin(gl_FragCoord.y * 1.5707);
  return col;
}`;

/* --------------------------------------------------------- Silver Screen */
const silverscreen = /* glsl */ `
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float tt = floor(uTime * 24.0);
  vec2 u = uv + (vec2(hash11(tt), hash11(tt + 3.1)) - 0.5) * vec2(0.0014, 0.0018);
  vec2 p = (u - 0.5) * vec2(asp, 1.0);
  float base = 0.05 + 0.05 * smoothstep(0.0, 0.7, u.y);
  vec2 o = vec2(uMouse.x * 0.02, -0.78);
  vec2 d = p - o;
  float a = atan(d.x, d.y);
  float fr = fract(a * 9.0 / PI + uTime * 0.008);
  float rays = step(0.5, fr);
  float rd = length(d);
  float burst = rays * smoothstep(1.95, 0.55, rd) * 0.1;
  float goldEdge = smoothstep(0.035, 0.0, abs(fr - 0.5)) * smoothstep(1.9, 0.6, rd);
  vec2 bo = vec2(0.42 * asp, 0.62);
  vec2 bd = p - bo;
  float ba = atan(bd.x, -bd.y);
  float beam = exp(-abs(ba + 0.62) * 6.5) * smoothstep(0.0, 0.35, length(bd));
  float smoke = fbm(p * 2.1 + vec2(uTime * 0.035, -uTime * 0.02));
  float lum = base + burst + beam * (0.32 + smoke * 0.5);
  vec3 col = vec3(lum) * vec3(1.0, 0.985, 0.955);
  col += vec3(0.62, 0.48, 0.18) * goldEdge * 0.35;
  float cx = abs(p.x) - (asp * 0.5 - 0.22 - sin(uTime * 0.2) * 0.008);
  if (cx > 0.0){
    float folds = 0.5 + 0.5 * sin(cx * 95.0 + fbm3(vec2(cx * 10.0, u.y * 2.0)) * 3.0);
    vec3 velvet = vec3(0.3, 0.025, 0.05) * (0.35 + folds * 0.65) * (0.55 + 0.45 * smoothstep(0.0, 0.22, cx));
    col = mix(col, velvet, smoothstep(0.0, 0.02, cx));
  }
  col *= 0.93 + 0.07 * hash11(tt * 1.7);
  float sx = hash11(tt * 0.37);
  float scratch = step(0.78, hash11(tt * 0.11)) * smoothstep(0.0016, 0.0, abs(uv.x - sx)) * (0.5 + 0.5 * vnoise(vec2(uv.y * 40.0, tt)));
  col += vec3(0.5) * scratch * 0.55;
  float speck = step(0.9993, hash21(floor(gl_FragCoord.xy / 2.0) + tt));
  col -= speck * 0.35;
  return col;
}`;

/* ----------------------------------------------------------- Ember Realm */
const emberrealm = /* glsl */ `
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  vec3 col = mix(vec3(1.0, 0.6, 0.27), vec3(0.06, 0.1, 0.12), smoothstep(0.26, 0.82, uv.y));
  col = mix(col, vec3(0.012, 0.022, 0.028), smoothstep(0.78, 1.05, uv.y));
  vec2 lc = vec2(0.14 * asp + uMouse.x * 0.02, -0.12);
  float ld = length((p - lc) * vec2(0.8, 1.0));
  col += vec3(1.0, 0.74, 0.34) * exp(-ld * 3.0) * 0.82;
  float ang = atan(p.x - lc.x, p.y - lc.y);
  float rays = fbm3(vec2(ang * 7.0, uTime * 0.035));
  col += vec3(1.0, 0.7, 0.3) * pow(rays, 3.5) * exp(-ld * 1.2) * smoothstep(-0.2, 0.2, p.y - lc.y) * 0.6;
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    float x = p.x * (1.0 + fi * 0.55) + uMouse.x * (0.02 + fi * 0.045) + fi * 9.0;
    float h = 0.43 - fi * 0.085 + ridge(vec2(x * 1.1, fi * 3.0)) * (0.17 - fi * 0.02);
    if (uv.y < h){
      vec3 mc = mix(vec3(0.4, 0.31, 0.21), vec3(0.02, 0.03, 0.025), fi / 3.0);
      float rim = smoothstep(h - 0.012, h, uv.y) * (1.0 - fi / 3.0);
      col = mc + vec3(1.0, 0.7, 0.35) * rim * 0.55;
    }
    float fogN = fbm(vec2(x * 1.5 + uTime * 0.02 * (fi + 1.0), uv.y * 5.0 + fi));
    col = mix(col, vec3(0.55, 0.45, 0.32) * (1.0 - fi * 0.2), smoothstep(h, h - 0.12, uv.y) * fogN * 0.25 * (1.0 - fi * 0.2));
  }
  float fx = p.x * 7.0 + uMouse.x * 0.3;
  float tid = floor(fx);
  float tf = fract(fx) - 0.5;
  float th = 0.13 + hash11(tid) * 0.1;
  float tree = step(uv.y, th - abs(tf) * (0.34 + hash11(tid + 2.0) * 0.3));
  float tree2 = step(uv.y, 0.06 + vnoise(vec2(p.x * 20.0, 1.0)) * 0.05);
  col = mix(col, vec3(0.012, 0.016, 0.012), max(tree, tree2));
  return col;
}`;

const SCENES: Partial<Record<ThemeId, string>> = {
  moonwake,
  sundown,
  lanternmere,
  gloamwood,
  velocity,
  vigil,
  skyward,
  mirage,
  glitchpop,
  winedark,
  fimbulwinter,
  eventhorizon,
  midnightdrive,
  silverscreen,
  emberrealm,
};

export function sceneSource(id: ThemeId): string {
  return COMMON + WLIB + (SCENES[id] ?? SCENES.winedark!) + MAIN;
}

/* ------------------------------------------------------------ Transitions */
export const TRANSITION_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uP;
uniform int uStyle;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uOrigin;
out vec4 fragColor;
${NOISE}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  float p = clamp(uP, 0.0, 1.0);
  vec3 a = texture(uA, uv).rgb;
  vec3 b = texture(uB, uv).rgb;
  float s = sin(p * PI);
  vec3 col;
  if (uStyle == 0) {
    float flash = (exp(-pow((p - 0.16) * 10.0, 2.0)) + 0.7 * exp(-pow((p - 0.34) * 16.0, 2.0))) * step(0.02, p);
    vec3 base = p < 0.3 ? a : b;
    col = mix(base, b, smoothstep(0.34, 1.0, p)) + vec3(0.82, 0.87, 1.0) * flash;
  } else if (uStyle == 1) {
    float d = length((uv - uOrigin) * vec2(asp, 1.0));
    float r = p * 2.6;
    float m = smoothstep(r, r - 0.3, d);
    col = mix(a, b, m) + vec3(1.0, 0.92, 0.72) * exp(-abs(d - r + 0.15) * 9.0) * s * 0.8;
  } else if (uStyle == 2) {
    float n = fbm(vec2(uv.x * 2.0 - p * 3.0, uv.y * 14.0));
    float v = uv.x * 0.6 + n * 0.6;
    float m = 1.0 - smoothstep(p * 1.4 - 0.2, p * 1.4, v);
    col = mix(a, b, m);
    col = mix(col, vec3(0.96, 0.72, 0.46), s * 0.55 * (0.5 + n * 0.5));
  } else if (uStyle == 3) {
    float band = floor(uv.y * 30.0);
    float r = hash11(band + floor(p * 14.0));
    float m = step(r, p * 1.25 - 0.1);
    vec2 off = vec2((hash11(band + 9.0) - 0.5) * 0.1 * s, 0.0);
    vec3 a2 = vec3(texture(uA, uv + off).r, a.g, texture(uA, uv - off).b);
    vec3 b2 = vec3(texture(uB, uv - off).r, b.g, texture(uB, uv + off).b);
    col = mix(a2, b2, m);
  } else if (uStyle == 4) {
    float crest = p * 1.32 - 0.16 + sin(uv.x * 9.0 + p * 6.0) * 0.03 + (fbm(vec2(uv.x * 6.0, p * 3.0)) - 0.5) * 0.08;
    float m = smoothstep(crest + 0.01, crest - 0.01, uv.y);
    float foam = exp(-abs(uv.y - crest) * 60.0) * (0.6 + 0.4 * fbm(vec2(uv.x * 30.0, p * 9.0)));
    col = mix(a, b, m) + vec3(0.82, 0.92, 0.92) * foam * s * 0.85;
  } else if (uStyle == 5) {
    float n = ridge(uv * vec2(asp, 1.0) * 4.0);
    float d = length((uv - 0.5) * vec2(asp, 1.0));
    float v = n * 0.6 + (1.0 - d) * 0.6;
    float t = p * 1.6 - 0.3;
    float m = 1.0 - smoothstep(t, t + 0.08, v);
    float edge = exp(-abs(v - t) * 40.0);
    col = mix(a, b, m) + vec3(0.7, 0.92, 1.0) * edge * s * 0.75;
  } else if (uStyle == 6) {
    vec2 c = vec2(0.5);
    vec3 acc = vec3(0.0);
    float mixAB = smoothstep(0.35, 0.65, p);
    for (int i = 0; i < 8; i++){
      float k = float(i) / 7.0;
      vec2 suv = c + (uv - c) * (1.0 - s * 0.32 * k);
      acc += mix(texture(uA, suv).rgb, texture(uB, suv).rgb, mixAB);
    }
    col = acc / 8.0 + vec3(1.0, 0.85, 0.65) * s * s * 0.35 * exp(-length((uv - c) * vec2(asp, 1.0)) * 2.0);
  } else if (uStyle == 7) {
    float y = 1.0 - p * 1.1;
    float m = step(y, uv.y);
    col = mix(a, b, m) + vec3(1.0, 0.3, 0.8) * exp(-abs(uv.y - y) * 120.0) * 1.2 + vec3(0.2, 0.9, 1.0) * exp(-abs(uv.y - y - 0.012) * 220.0) * 0.6;
  } else if (uStyle == 8) {
    float n = fbm(uv * vec2(asp, 1.0) * 3.0 + 4.0);
    float t = p * 1.3 - 0.15;
    float m = smoothstep(t, t - 0.06, n);
    col = mix(a, b, m) + vec3(1.0, 0.58, 0.18) * exp(-abs(n - t) * 50.0) * 1.4 * s + vec3(1.0, 0.95, 0.8) * exp(-abs(n - t) * 160.0) * s;
  } else {
    float n = fbm(vec2(uv.x * 4.0, uv.y * 3.0 - p * 2.5));
    float v = uv.y * 0.7 + n * 0.5;
    float t = p * 1.5 - 0.25;
    float m = 1.0 - smoothstep(t - 0.05, t + 0.05, v);
    col = mix(a, b, m) + vec3(1.0, 0.6, 0.22) * exp(-abs(v - t) * 34.0) * s * 1.1;
  }
  fragColor = vec4(max(col, 0.0), 1.0);
}`;
