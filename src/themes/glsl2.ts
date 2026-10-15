/* GLSL for the six worlds added in 1.1: Sundown, Frostkeep, Moonspire, Hanami, Lagoon and Hollow Pines. */

/* --------------------------------------------------------------- Sundown */
export const sundown = /* glsl */ `
float mesas(float x, float seed, float base, float amp){
  float h = base + (vnoise(vec2(x * 3.0, seed)) - 0.5) * 0.02;
  for (int i = 0; i < 5; i++){
    float fi = float(i);
    float c = hash11(seed + fi * 3.1) * 3.2 - 0.6;
    float w = 0.08 + hash11(seed + fi * 7.7) * 0.2;
    float top = amp * (0.45 + 0.55 * hash11(seed + fi * 5.3));
    float d = abs(x - c);
    float slope = 0.035 + 0.05 * hash11(seed + fi * 1.9);
    float plateau = top * (1.0 - smoothstep(w, w + slope, d));
    h = max(h, base + plateau + (vnoise(vec2(x * 60.0, fi + seed)) - 0.5) * 0.004 * step(d, w + slope));
  }
  return h;
}
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 q = vec2(uv.x * asp, uv.y);
  float hz = 0.34;
  float t = smoothstep(hz - 0.05, 1.0, uv.y);
  vec3 col = mix(vec3(1.0, 0.6, 0.27), vec3(0.86, 0.3, 0.17), smoothstep(0.0, 0.3, t));
  col = mix(col, vec3(0.42, 0.13, 0.23), smoothstep(0.25, 0.65, t));
  col = mix(col, vec3(0.11, 0.06, 0.19), smoothstep(0.6, 1.0, t));
  vec2 sun = vec2(0.33 * asp + uMouse.x * 0.03, hz + 0.075 + uMouse.y * 0.012);
  float d = length(q - sun);
  col += vec3(1.0, 0.5, 0.2) * exp(-d * 2.4) * 0.55;
  col += vec3(1.0, 0.82, 0.5) * exp(-d * 10.0) * 0.7;
  float disc = smoothstep(0.072, 0.066, d);
  float bands = step(0.5, fract((q.y - sun.y) * 70.0)) * smoothstep(0.0, -0.05, q.y - sun.y);
  col = mix(col, mix(vec3(1.0, 0.93, 0.72), vec3(1.0, 0.7, 0.4), bands * 0.6), disc);
  float n = fbm(vec2(q.x * 0.9 + uTime * 0.008, uv.y * 13.0));
  float streak = smoothstep(0.55, 0.82, n) * smoothstep(hz + 0.04, 0.55, uv.y) * smoothstep(0.98, 0.62, uv.y);
  vec3 sc = mix(vec3(1.0, 0.62, 0.36), vec3(0.45, 0.13, 0.2), smoothstep(0.42, 0.85, uv.y));
  col = mix(col, sc, streak * 0.75);
  for (int L = 0; L < 2; L++){
    float fl = float(L) * 2.0;
    float x = q.x * (0.75 + fl * 0.4) + uMouse.x * (0.01 + fl * 0.03) + fl * 4.3;
    float h = mesas(x, fl * 17.0 + 3.0, hz - 0.01 - fl * 0.06, 0.17 - fl * 0.02);
    if (uv.y < h){
      vec3 mc = mix(vec3(0.62, 0.24, 0.2), vec3(0.11, 0.035, 0.05), fl / 2.0);
      float strata = 0.86 + 0.14 * sin(uv.y * (180.0 + fl * 60.0) + vnoise(vec2(x * 8.0, uv.y * 30.0)) * 3.0);
      mc *= mix(1.0, strata, 0.4 + fl * 0.3);
      float rim = smoothstep(h - 0.01, h, uv.y) * (1.0 - fl * 0.4);
      mc += vec3(1.0, 0.55, 0.25) * rim * 0.35;
      mc = mix(mc, vec3(0.95, 0.5, 0.3), (2.0 - fl) * 0.18 * (1.0 - smoothstep(hz - 0.15, h, uv.y)));
      col = mc;
    }
  }
  float gy = 0.2 + (vnoise(vec2(q.x * 2.0, 4.0)) - 0.5) * 0.03;
  if (uv.y < gy){
    float depth = (gy - uv.y) / gy;
    vec3 g = mix(vec3(0.42, 0.15, 0.08), vec3(0.06, 0.025, 0.03), smoothstep(0.0, 1.0, depth));
    float scrub = smoothstep(0.7, 0.78, vnoise(q * vec2(160.0, 300.0) / (0.35 + depth))) * (0.3 + depth);
    g = mix(g, vec3(0.03, 0.015, 0.015), scrub * 0.7);
    g += vec3(0.9, 0.4, 0.15) * exp(-depth * 9.0) * 0.18;
    col = g;
  }
  vec2 vp = vec2(0.7 * asp, gy + 0.01);
  vec2 fp = vec2(0.02 * asp + uMouse.x * 0.05, -0.12);
  float pole = 0.0;
  vec2 prevTop = vec2(0.0);
  for (int k = 0; k < 9; k++){
    float z = 1.0 + float(k) * 1.15;
    vec2 base = vp + (fp - vp) / z;
    float hgt = 0.62 / z;
    float w = 0.0065 / z + 0.0008;
    vec2 top = vec2(base.x, base.y + hgt);
    pole = max(pole, step(abs(q.x - base.x), w) * step(base.y, uv.y) * step(uv.y, top.y));
    pole = max(pole, step(abs(uv.y - (top.y - hgt * 0.07)), w * 0.7) * step(abs(q.x - base.x), hgt * 0.13));
    if (k > 0){
      for (int wi = 0; wi < 2; wi++){
        float off = (float(wi) - 0.5) * hgt * 0.18;
        vec2 a = vec2(prevTop.x + off * 1.4, prevTop.y - hgt * 0.07);
        vec2 b = vec2(top.x + off, top.y - hgt * 0.07);
        float s = (q.x - a.x) / (b.x - a.x);
        if (s > 0.0 && s < 1.0){
          float y = mix(a.y, b.y, s) - 0.035 / z * 4.0 * s * (1.0 - s);
          pole = max(pole, smoothstep(0.0018, 0.0006, abs(uv.y - y)) * 0.85);
        }
      }
    }
    prevTop = top;
  }
  col = mix(col, vec3(0.05, 0.02, 0.03), pole);
  float haze = fbm(vec2(q.x * 1.6 - uTime * 0.03, uv.y * 7.0));
  col += vec3(1.0, 0.5, 0.25) * haze * exp(-abs(uv.y - hz) * 10.0) * 0.18;
  return col;
}`;

/* ------------------------------------------------------------- Frostkeep */
export const frostkeep = /* glsl */ `
float box(vec2 q, vec2 c, vec2 hs){ vec2 d = abs(q - c) - hs; return step(max(d.x, d.y), 0.0); }
float tower(vec2 q, float cx, float base, float w, float h, float roof){
  float body = box(q, vec2(cx, base + h * 0.5), vec2(w, h * 0.5));
  float r = step(base + h, q.y) * step(q.y, base + h + roof) * step(abs(q.x - cx), w * 1.15 * (1.0 - (q.y - base - h) / roof));
  return max(body, r);
}
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 q = vec2(uv.x * asp, uv.y);
  vec3 col = mix(vec3(0.5, 0.58, 0.68), vec3(0.09, 0.12, 0.2), smoothstep(0.3, 1.0, uv.y));
  float cl = fbm(vec2(q.x * 1.3 + uTime * 0.012, uv.y * 3.2 - uTime * 0.004));
  col = mix(col, vec3(0.62, 0.68, 0.76) * (0.7 + 0.3 * cl), smoothstep(0.45, 0.8, cl) * smoothstep(0.35, 0.7, uv.y) * 0.7);
  vec2 moon = vec2(0.24 * asp, 0.8);
  float md = length(q - moon);
  col += vec3(0.75, 0.82, 0.95) * exp(-md * 6.0) * 0.35 * (1.0 - smoothstep(0.5, 0.8, cl));
  float px = 0.63 * asp + uMouse.x * 0.02;
  float yb = 0.7;
  float m = 0.76 - abs(q.x - px) * 0.95 + (ridge(vec2(q.x * 3.0, 1.0)) - 0.5) * 0.09;
  m = max(m, yb - 0.012 - max(abs(q.x - px) - 0.1, 0.0) * 1.6 + (vnoise(vec2(q.x * 40.0, 3.0)) - 0.5) * 0.01);
  m = max(m, 0.3 + (fbm(vec2(q.x * 1.4, 2.0)) - 0.5) * 0.12);
  if (uv.y < m){
    float side = smoothstep(-0.1, 0.16, q.x - px + (fbm(q * 7.0) - 0.5) * 0.22);
    float rs = fbm(vec2(q.x * 14.0, uv.y * 22.0));
    vec3 lit = vec3(0.82, 0.86, 0.93) * (0.85 + 0.2 * rs);
    vec3 shade = vec3(0.3, 0.36, 0.48) * (0.8 + 0.3 * rs);
    vec3 mc = mix(lit, shade, side);
    float rock = smoothstep(0.7, 0.76, fbm(vec2(q.x * 30.0, uv.y * 14.0)) + (m - uv.y) * 0.25) * 0.55;
    mc = mix(mc, vec3(0.12, 0.14, 0.2), rock);
    mc = mix(mc, vec3(0.52, 0.6, 0.7), smoothstep(m - 0.25, m - 0.6, uv.y) * 0.5);
    col = mc;
  }
  float k = 0.0;
  k = max(k, tower(q, px, yb, 0.022, 0.15, 0.06));
  k = max(k, tower(q, px - 0.06, yb, 0.014, 0.1, 0.045));
  k = max(k, tower(q, px + 0.065, yb, 0.015, 0.09, 0.04));
  k = max(k, tower(q, px - 0.108, yb, 0.011, 0.065, 0.035));
  k = max(k, tower(q, px + 0.112, yb, 0.01, 0.058, 0.03));
  float wall = box(q, vec2(px, yb + 0.0175), vec2(0.12, 0.0175));
  float cren = step(0.45, fract(q.x * 140.0)) * step(abs(uv.y - (yb + 0.038)), 0.004) * step(abs(q.x - px), 0.12);
  k = max(k, max(wall, cren));
  float spire = step(abs(q.x - px), 0.0018) * step(yb + 0.19, uv.y) * step(uv.y, yb + 0.235);
  k = max(k, spire);
  if (k > 0.5){
    vec3 kc = vec3(0.09, 0.1, 0.14);
    vec2 wg = vec2(q.x * 180.0, uv.y * 120.0);
    vec2 wid = floor(wg);
    vec2 wf = fract(wg);
    float win = step(0.7, hash21(wid)) * step(yb + 0.04, uv.y) * step(0.3, wf.x) * step(wf.x, 0.7) * step(0.25, wf.y) * step(wf.y, 0.75) * step(yb - 0.01, uv.y);
    float fl = 0.75 + 0.25 * sin(uTime * (1.0 + hash21(wid) * 3.0) + hash21(wid + 2.0) * 6.28);
    kc += vec3(1.0, 0.68, 0.32) * win * fl * 0.9;
    col = kc;
  }
  col += vec3(1.0, 0.6, 0.3) * exp(-length((q - vec2(px, yb + 0.06)) * vec2(1.0, 1.6)) * 14.0) * 0.12;
  for (int i = 0; i < 2; i++){
    float fi = float(i);
    float x = q.x * (1.2 + fi * 0.9) + uMouse.x * (0.04 + fi * 0.06) + fi * 6.0;
    float h = 0.2 - fi * 0.09 + (fbm(vec2(x * 1.2, fi * 4.0)) - 0.5) * 0.1;
    float tx = x * 9.0;
    float tid = floor(tx);
    float tf = fract(tx) - 0.5;
    float th = h + 0.05 + hash11(tid + fi * 13.0) * 0.08;
    float pine = step(uv.y, th - abs(tf) * (0.28 + hash11(tid + 5.0) * 0.12) * (1.0 + 0.4 * step(0.5, fract((th - uv.y) * 28.0)))) * step(0.35, hash11(tid * 3.3 + fi));
    vec3 snowC = mix(vec3(0.62, 0.7, 0.8), vec3(0.85, 0.9, 0.96), fbm(q * 18.0)) * (1.0 - fi * 0.25);
    if (uv.y < h) col = snowC * (0.75 + 0.25 * smoothstep(h - 0.1, h, uv.y));
    if (pine > 0.5 && uv.y > h - 0.02) col = mix(vec3(0.05, 0.08, 0.1), vec3(0.02, 0.03, 0.05), fi) + vec3(0.6, 0.7, 0.8) * step(0.8, fract((th - uv.y) * 28.0)) * 0.25;
  }
  float mist = fbm(vec2(q.x * 2.0 - uTime * 0.04, uv.y * 5.0));
  col = mix(col, vec3(0.7, 0.76, 0.84), mist * smoothstep(0.42, 0.22, uv.y) * 0.32);
  return col;
}`;

/* ------------------------------------------------------------- Moonspire */
export const moonspire = /* glsl */ `
float spires(vec2 q, float base, out float lit){
  float k = 0.0;
  lit = 0.0;
  for (int i = 0; i < 9; i++){
    float fi = float(i);
    float cx = 0.56 + fi * 0.042 + (hash11(fi * 3.7) - 0.5) * 0.02;
    float w = 0.008 + hash11(fi * 1.3) * 0.012;
    float h = 0.06 + hash11(fi * 9.1) * 0.17 * (1.0 - abs(fi - 4.0) / 6.0);
    float b = base + (hash11(fi * 4.4) - 0.5) * 0.02;
    float body = step(abs(q.x - cx), w) * step(b, q.y) * step(q.y, b + h);
    float rh = w * 4.2;
    float roof = step(b + h, q.y) * step(q.y, b + h + rh) * step(abs(q.x - cx), w * 1.25 * (1.0 - (q.y - b - h) / rh));
    float win = step(0.8, hash21(floor(vec2(q.x * 260.0, q.y * 140.0)))) * step(0.3, fract(q.x * 260.0)) * step(fract(q.x * 260.0), 0.7) * step(0.3, fract(q.y * 140.0)) * step(fract(q.y * 140.0), 0.75) * body;
    lit = max(lit, win);
    k = max(k, max(body, roof));
  }
  float hall = step(abs(q.x - 0.72), 0.14) * step(q.y, base + 0.05) * step(base - 0.05, q.y);
  return max(k, hall);
}
vec3 above(vec2 uv, float asp){
  vec2 q = vec2(uv.x, uv.y);
  vec2 qa = vec2(uv.x * asp, uv.y);
  vec3 col = mix(vec3(0.16, 0.1, 0.3), vec3(0.01, 0.015, 0.06), smoothstep(0.25, 1.0, uv.y));
  vec2 g = qa * 140.0;
  vec2 id = floor(g);
  float st = hash21(id);
  float tw = 0.6 + 0.4 * sin(uTime * (1.0 + st * 3.0) + st * 50.0);
  col += vec3(0.85, 0.85, 1.0) * step(0.985, st) * smoothstep(0.35, 0.0, length(fract(g) - 0.5)) * tw * smoothstep(0.35, 0.8, uv.y);
  vec2 moon = vec2(0.24 * asp + uMouse.x * 0.02, 0.76 + uMouse.y * 0.01);
  float md = length(qa - moon);
  col += vec3(0.6, 0.65, 0.95) * exp(-md * 5.0) * 0.4;
  float craters = fbm(qa * 22.0);
  col = mix(col, vec3(0.93, 0.92, 0.86) * (0.82 + 0.25 * craters), smoothstep(0.072, 0.068, md));
  float cl = fbm(vec2(qa.x * 1.6 + uTime * 0.01, uv.y * 4.0));
  col = mix(col, vec3(0.2, 0.18, 0.36), smoothstep(0.55, 0.85, cl) * smoothstep(0.45, 0.75, uv.y) * 0.6);
  float hill = 0.33 + (fbm(vec2(uv.x * 3.0, 7.0)) - 0.5) * 0.08 - smoothstep(0.4, 0.0, uv.x) * 0.03;
  if (uv.y < hill) col = vec3(0.03, 0.03, 0.07);
  float cliff = 0.31 + smoothstep(0.45, 0.62, uv.x) * 0.17 + (vnoise(vec2(uv.x * 30.0, 2.0)) - 0.5) * 0.02;
  if (uv.y < cliff && uv.x > 0.4){
    float rs = fbm(vec2(uv.x * 20.0, uv.y * 30.0));
    col = mix(vec3(0.05, 0.05, 0.1), vec3(0.12, 0.12, 0.2), rs * smoothstep(0.5, 0.7, uv.x));
  }
  float lit;
  float k = spires(q, cliff, lit);
  if (k > 0.5 && uv.x > 0.45){
    col = vec3(0.05, 0.05, 0.11);
    float fl = 0.8 + 0.2 * sin(uTime * 2.0 + uv.x * 300.0);
    col += vec3(1.0, 0.75, 0.35) * lit * fl;
  }
  col += vec3(1.0, 0.7, 0.35) * exp(-length((qa - vec2(0.72 * asp, cliff + 0.08)) * vec2(0.6, 1.2)) * 6.0) * 0.15;
  return col;
}
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float wl = 0.27;
  if (uv.y >= wl) return above(uv, asp);
  float depth = (wl - uv.y) / wl;
  float rip = (fbm(vec2(uv.x * 30.0, uv.y * 90.0 / (0.3 + depth) - uTime * 0.5)) - 0.5) * 0.02 * (0.3 + depth);
  vec3 r = above(vec2(uv.x + rip, wl + (wl - uv.y) * 1.05 + rip * 0.5), asp);
  vec3 col = r * mix(0.55, 0.25, depth) + vec3(0.01, 0.015, 0.04);
  float mx = 0.24 + uMouse.x * 0.02 / asp;
  float path = exp(-abs(uv.x - mx) * (14.0 - depth * 8.0)) * smoothstep(0.55, 0.85, vnoise(vec2(uv.x * 90.0, uv.y * 300.0 - uTime * 2.0)));
  col += vec3(0.85, 0.85, 1.0) * path * 0.8;
  col += vec3(0.6, 0.65, 0.9) * exp(-abs(uv.y - wl) * 120.0) * 0.08;
  return col;
}`;

/* ---------------------------------------------------------------- Hanami */
export const hanami = /* glsl */ `
float segd(vec2 p, vec2 a, vec2 b, out float h){
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 q = vec2(uv.x * asp, uv.y);
  vec3 col = mix(vec3(1.0, 0.82, 0.7), vec3(0.98, 0.66, 0.72), smoothstep(0.28, 0.6, uv.y));
  col = mix(col, vec3(0.46, 0.38, 0.64), smoothstep(0.55, 1.0, uv.y));
  vec2 sun = vec2(0.52 * asp, 0.42);
  float sd = length(q - sun);
  col += vec3(1.0, 0.85, 0.7) * exp(-sd * 4.5) * 0.45;
  col = mix(col, vec3(1.0, 0.92, 0.84), smoothstep(0.052, 0.048, sd) * 0.9);
  float cl = fbm(vec2(q.x * 1.1 + uTime * 0.01, uv.y * 9.0));
  col = mix(col, vec3(1.0, 0.86, 0.88), smoothstep(0.58, 0.85, cl) * smoothstep(0.4, 0.62, uv.y) * smoothstep(0.85, 0.6, uv.y) * 0.6);
  float fx = 0.68 * asp + uMouse.x * 0.015;
  float fm = 0.66 - abs(q.x - fx) * 0.62;
  fm = min(fm, 0.6 + (vnoise(vec2(q.x * 30.0, 1.0)) - 0.5) * 0.01);
  if (uv.y < fm){
    vec3 mc = mix(vec3(0.62, 0.55, 0.75), vec3(0.78, 0.66, 0.8), smoothstep(0.3, 0.6, uv.y));
    float capLine = fm - 0.07 - vnoise(vec2(q.x * 26.0, 3.0)) * 0.05;
    float cap = smoothstep(capLine - 0.004, capLine, uv.y);
    mc = mix(mc, vec3(1.0, 0.95, 0.97), cap * 0.92);
    mc = mix(mc, vec3(1.0, 0.82, 0.86), smoothstep(0.3, 0.62, uv.y) * 0.25);
    col = mc;
  }
  for (int i = 0; i < 2; i++){
    float fi = float(i);
    float x = q.x * (1.3 + fi * 0.8) + uMouse.x * (0.03 + fi * 0.05) + fi * 3.0;
    float h = 0.36 - fi * 0.08 + (fbm(vec2(x, fi * 2.0)) - 0.5) * 0.08;
    if (uv.y < h) col = mix(vec3(0.6, 0.45, 0.62), vec3(0.32, 0.2, 0.32), fi) * (0.9 + 0.1 * fbm(q * 12.0));
    col = mix(col, vec3(1.0, 0.86, 0.88), smoothstep(h, h - 0.06, uv.y) * 0.25 * (1.0 - fi) * fbm(vec2(x * 2.0 + uTime * 0.03, uv.y * 8.0)));
  }
  float cx = 0.3 * asp + uMouse.x * 0.04;
  float y0 = 0.26;
  float pag = 0.0;
  for (int k = 0; k < 5; k++){
    float fk = float(k);
    float th = 0.05 - fk * 0.004;
    float yb = y0 + fk * 0.047 - fk * fk * 0.0012;
    float bw = 0.034 - fk * 0.004;
    float rw = 0.07 - fk * 0.008;
    pag = max(pag, step(abs(q.x - cx), bw) * step(yb, uv.y) * step(uv.y, yb + th * 0.62));
    float ry = uv.y - (yb + th * 0.55);
    float curl = pow(clamp(abs(q.x - cx) / rw, 0.0, 1.0), 4.0) * 0.012;
    pag = max(pag, step(-curl, ry) * step(ry, 0.012 - abs(q.x - cx) * 0.18) * step(abs(q.x - cx), rw));
  }
  pag = max(pag, step(abs(q.x - cx), 0.002) * step(0.47, uv.y) * step(uv.y, 0.54));
  pag = max(pag, step(abs(q.x - cx), 0.006) * step(abs(fract(uv.y * 90.0) - 0.5), 0.15) * step(0.48, uv.y) * step(uv.y, 0.52));
  col = mix(col, vec3(0.2, 0.09, 0.15), pag);
  float gx = 0.11 * asp + uMouse.x * 0.08;
  float tor = 0.0;
  tor = max(tor, step(abs(abs(q.x - gx) - 0.055), 0.0075) * step(uv.y, 0.4) * step(0.1, uv.y));
  tor = max(tor, step(abs(q.x - gx), 0.072) * step(abs(uv.y - 0.355), 0.006));
  float ky = 0.4 + pow(abs(q.x - gx) / 0.095, 3.0) * 0.012;
  tor = max(tor, step(abs(q.x - gx), 0.095) * step(abs(uv.y - ky), 0.009));
  vec3 torc = mix(vec3(0.82, 0.2, 0.12), vec3(0.15, 0.05, 0.05), step(abs(uv.y - ky), 0.009) * step(ky + 0.002, uv.y));
  col = mix(col, torc, tor);
  float gnd = 0.13 + (vnoise(vec2(q.x * 3.0, 5.0)) - 0.5) * 0.03;
  if (uv.y < gnd){
    vec3 gc = mix(vec3(0.36, 0.3, 0.32), vec3(0.18, 0.13, 0.17), (gnd - uv.y) / gnd);
    vec2 pg = q * vec2(260.0, 520.0);
    float speck = step(0.93, hash21(floor(pg))) * smoothstep(0.5, 0.2, length(fract(pg) - 0.5));
    col = mix(gc, vec3(1.0, 0.78, 0.88), speck * 0.85 + 0.12 * smoothstep(0.4, 0.8, vnoise(q * 6.0)));
  }
  float sw = sin(uTime * 0.4) * 0.006;
  vec2 P[7];
  P[0] = vec2(1.05 * asp, 0.98); P[1] = vec2(0.82 * asp, 0.86 + sw); P[2] = vec2(0.6 * asp, 0.92 + sw * 1.5);
  P[3] = vec2(1.04 * asp, 0.8); P[4] = vec2(0.86 * asp, 0.7 + sw); P[5] = vec2(0.74 * asp, 0.64 + sw * 1.6);
  P[6] = vec2(0.72 * asp, 1.02);
  float d = 1e3;
  float h;
  d = min(d, segd(q, P[0], P[1], h));
  d = min(d, segd(q, P[1], P[2], h));
  d = min(d, segd(q, P[3], P[4], h));
  d = min(d, segd(q, P[4], P[5], h));
  d = min(d, segd(q, P[1], P[6], h));
  float puff = fbm(q * 13.0 + 7.0);
  float bloom = smoothstep(0.1, 0.06, d - (puff - 0.5) * 0.1) * smoothstep(0.26, 0.4, fbm(q * 22.0));
  vec3 pink = mix(vec3(1.0, 0.7, 0.82), vec3(1.0, 0.92, 0.96), fbm(q * 40.0));
  pink = mix(pink, vec3(0.84, 0.46, 0.62), smoothstep(0.03, 0.07, d) * 0.45);
  float wood = smoothstep(0.0065, 0.0035, d + (vnoise(q * 80.0) - 0.5) * 0.003);
  col = mix(col, vec3(0.22, 0.11, 0.13), wood);
  col = mix(col, pink, bloom * 0.95);
  return col;
}`;

/* ---------------------------------------------------------------- Lagoon */
export const lagoon = /* glsl */ `
float segd(vec2 p, vec2 a, vec2 b, out float h){
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float frond(vec2 p, float ang, float len, float droop){
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 prev = vec2(0.0);
  float best = 1e3;
  float bt = 0.0;
  vec2 bdir = dir;
  for (int i = 1; i <= 7; i++){
    float t = float(i) / 7.0;
    vec2 cur = dir * len * t + vec2(0.0, -droop * t * t);
    float h;
    float d = segd(p, prev, cur, h);
    if (d < best){ best = d; bt = (float(i) - 1.0 + h) / 7.0; bdir = normalize(cur - prev); }
    prev = cur;
  }
  vec2 nrm = vec2(-bdir.y, bdir.x);
  vec2 cp = p;
  float side = dot(cp, nrm);
  float w = 0.045 * sin(min(bt * 1.15, 1.0) * 3.14159) + 0.004;
  float rib = smoothstep(0.004, 0.002, best);
  float leaf = step(best, w) * step(0.12, bt);
  float along = bt * len * 120.0 + best * 60.0;
  float comb = step(0.38, fract(along));
  float hang = step(-w * 0.35, -side * sign(nrm.y + 1e-4));
  return max(rib, leaf * comb * mix(0.55, 1.0, hang));
}
float palm(vec2 q, vec2 base, float hgt, float lean, float sw){
  float m = 0.0;
  float t = clamp((q.y - base.y) / hgt, 0.0, 1.0);
  float tx = base.x + lean * t * t;
  float tw = mix(0.016, 0.009, t);
  float rings = 0.85 + 0.15 * step(0.5, fract(q.y * 90.0));
  m = max(m, step(abs(q.x - tx), tw) * step(base.y, q.y) * step(q.y, base.y + hgt) * rings);
  vec2 crown = vec2(base.x + lean, base.y + hgt);
  vec2 p = q - crown;
  for (int j = 0; j < 11; j++){
    float fj = float(j);
    float a = 0.15 + fj * 0.285 + sw * (0.6 + 0.4 * sin(fj * 2.3)) + (hash11(fj * 3.1) - 0.5) * 0.15;
    float up = sin(a);
    m = max(m, frond(p, a, 0.16 + 0.06 * hash11(fj), 0.09 + 0.1 * (1.0 - up)));
  }
  m = max(m, step(length((p - vec2(0.008, -0.018)) * vec2(1.0, 1.1)), 0.012));
  m = max(m, step(length(p - vec2(-0.012, -0.022)), 0.011));
  return m;
}
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 q = vec2(uv.x * asp, uv.y);
  float hz = 0.47;
  vec3 col = mix(vec3(0.78, 0.92, 1.0), vec3(0.17, 0.52, 0.94), smoothstep(hz, 1.0, uv.y));
  vec2 sun = vec2(0.74 * asp + uMouse.x * 0.02, 0.84);
  float sd = length(q - sun);
  col += vec3(1.0, 0.97, 0.85) * exp(-sd * 4.0) * 0.5;
  col = mix(col, vec3(1.0, 1.0, 0.96), smoothstep(0.06, 0.05, sd));
  float cn = fbm(vec2(q.x * 1.6 + uTime * 0.012, uv.y * 3.6));
  float cloud = smoothstep(0.5, 0.75, cn + (0.62 - uv.y) * 0.8) * smoothstep(hz, hz + 0.08, uv.y) * smoothstep(0.85, 0.55, uv.y);
  col = mix(col, mix(vec3(0.82, 0.86, 0.95), vec3(1.0), smoothstep(0.55, 0.85, cn)), cloud * 0.85);
  if (uv.y < hz){
    float v = 1.0 / max(hz - uv.y, 0.002);
    float wx = (q.x - 0.5 * asp) * v * 0.08;
    float wn = fbm(vec2(wx * 6.0, v * 0.35 - uTime * 0.25)) + 0.5 * fbm(vec2(wx * 14.0 + uTime * 0.1, v * 0.9 - uTime * 0.6));
    float near = smoothstep(hz, 0.15, uv.y);
    vec3 w = mix(vec3(0.05, 0.38, 0.62), vec3(0.06, 0.72, 0.74), near);
    w *= 0.85 + 0.25 * wn;
    float glint = pow(max(wn - 0.6, 0.0) * 2.4, 3.0) * exp(-abs(q.x - sun.x) * (2.5 + v * 0.05)) * 2.2;
    w += vec3(1.0, 0.98, 0.9) * glint;
    w = mix(w, vec3(0.75, 0.9, 1.0), exp(-(hz - uv.y) * 60.0) * 0.5);
    col = w;
  }
  float sh = 0.19 + 0.025 * sin(uTime * 0.45 + q.x * 1.3) + (vnoise(vec2(q.x * 4.0, 1.0)) - 0.5) * 0.02;
  if (uv.y < sh + 0.012){
    float foam = smoothstep(0.012, 0.0, abs(uv.y - sh)) * (0.6 + 0.4 * vnoise(vec2(q.x * 80.0, uTime)));
    vec3 sand = mix(vec3(0.97, 0.89, 0.72), vec3(0.88, 0.76, 0.58), smoothstep(0.0, 0.2, sh - uv.y));
    float wet = smoothstep(0.05, 0.0, sh - uv.y) * step(uv.y, sh);
    sand = mix(sand, vec3(0.72, 0.62, 0.48), wet * 0.6);
    sand *= 0.94 + 0.08 * vnoise(q * 140.0);
    if (uv.y < sh) col = sand;
    col = mix(col, vec3(1.0), foam * 0.9);
  }
  float sw = sin(uTime * 0.9) * 0.05;
  float pm = palm(q, vec2(-0.05 * asp + uMouse.x * 0.05, -0.05), 0.98, 0.06, sw);
  pm = max(pm, palm(q, vec2(1.04 * asp + uMouse.x * 0.05, -0.04), 0.9, -0.07, -sw * 0.8));
  col = mix(col, vec3(0.06, 0.2, 0.12), pm);
  return col;
}`;

/* ----------------------------------------------------------- Hollow Pines */
export const hollowpines = /* glsl */ `
vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  vec2 q = vec2(uv.x * asp, uv.y);
  vec3 fog = vec3(0.16, 0.22, 0.21);
  vec3 col = mix(vec3(0.28, 0.34, 0.32), vec3(0.05, 0.08, 0.09), smoothstep(0.25, 1.0, uv.y));
  vec2 moon = vec2(0.62 * asp + uMouse.x * 0.02, 0.7);
  float md = length(q - moon);
  col += vec3(0.7, 0.8, 0.74) * exp(-md * 3.2) * 0.35;
  col = mix(col, vec3(0.88, 0.92, 0.86), smoothstep(0.055, 0.05, md) * 0.85);
  vec2 rd = normalize(q - moon);
  float ang = atan(rd.y, rd.x);
  float shafts = pow(fbm3(vec2(ang * 9.0, uTime * 0.03)), 2.5) * exp(-md * 1.1) * smoothstep(0.0, 0.3, moon.y - uv.y + 0.2);
  for (int L = 0; L < 4; L++){
    float fl = float(L);
    float dens = 6.0 - fl * 1.1;
    float x = q.x * dens + uMouse.x * (0.05 + fl * 0.12) + fl * 3.7;
    float id = floor(x);
    float fx = fract(x);
    float present = step(0.25, hash11(id * 1.7 + fl * 9.0));
    float cxp = 0.5 + (hash11(id * 4.1 + fl) - 0.5) * 0.5;
    float lean = (hash11(id * 2.9 + fl) - 0.5) * 0.06;
    float w = (0.05 + 0.06 * hash11(id * 7.3 + fl)) * (1.0 + fl * 0.35);
    float trunk = step(abs(fx - cxp - lean * (uv.y - 0.5) * dens), w * (1.0 + (0.3 - uv.y) * 0.3)) * present;
    float br = 0.0;
    for (int b = 0; b < 3; b++){
      float fb = float(b);
      float by = 0.35 + hash11(id * 3.3 + fb * 5.0 + fl) * 0.5;
      float dir = sign(hash11(id + fb * 7.0) - 0.5);
      float dx = (fx - cxp) * dir;
      float yy = by + dx * (0.35 + hash11(id + fb) * 0.3) / dens;
      br = max(br, step(0.0, dx) * step(dx, 0.35 + fl * 0.1) * step(abs(uv.y - yy), 0.0035 * (1.0 + fl) * (1.0 - dx * 1.6)));
    }
    float tree = max(trunk, br * present);
    float bark = 0.85 + 0.15 * vnoise(vec2(fx * 30.0, uv.y * 80.0));
    vec3 tc = mix(fog * (1.0 - fl * 0.18), vec3(0.012, 0.018, 0.018), smoothstep(0.0, 3.0, fl)) * bark;
    tc += vec3(0.5, 0.6, 0.55) * smoothstep(w * 0.4, w, (fx - cxp)) * trunk * 0.06 * (3.0 - fl);
    col = mix(col, tc, tree);
    col = mix(col, fog, (3.0 - fl) * 0.06);
  }
  col += vec3(0.55, 0.66, 0.6) * shafts * 0.45;
  float gy = 0.16 + (fbm(vec2(q.x * 2.0, 3.0)) - 0.5) * 0.06;
  if (uv.y < gy){
    float roots = smoothstep(0.6, 0.75, fbm(q * vec2(18.0, 40.0)));
    col = mix(vec3(0.04, 0.05, 0.045), vec3(0.01, 0.012, 0.012), roots);
  }
  float gf = fbm(vec2(q.x * 1.8 - uTime * 0.05, uv.y * 4.0 + uTime * 0.02));
  col = mix(col, vec3(0.32, 0.4, 0.38), smoothstep(0.38, 0.0, uv.y) * gf * 0.6);
  float hi = fbm(vec2(q.x * 0.9 + uTime * 0.02, uv.y * 2.5));
  col = mix(col, fog * 1.3, smoothstep(0.4, 0.8, hi) * 0.18);
  return col;
}`;
