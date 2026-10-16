/* Hanami: a pagoda above a still pond, cherry trees in full bloom at dusk, lanterns lit, petals on the wind. */

export const hanami = /* glsl */ `
const float HN_HZ = -0.085;
const float HN_WATER = -0.215;
const vec2 HN_PAGODA = vec2(0.24, -0.125);

vec3 hnSky(vec2 p, float px, float t, bool cheap){
  float h = p.y - HN_HZ;
  vec3 c = mix(vec3(1.00, 0.70, 0.50), vec3(0.98, 0.56, 0.58), smoothstep(0.0, 0.12, h));
  c = mix(c, vec3(0.60, 0.42, 0.66), smoothstep(0.10, 0.32, h));
  c = mix(c, vec3(0.17, 0.15, 0.36), smoothstep(0.28, 0.62, h));
  c += vec3(1.0, 0.62, 0.36) * exp(-length((p - vec2(-0.50, HN_HZ)) * vec2(0.7, 2.6)) * 2.6) * 0.50;
  vec2 mq = p - vec2(0.56, 0.31);
  float moon = max(sdCircle(mq, 0.026), -sdCircle(mq - vec2(0.010, 0.006), 0.024));
  c += vec3(1.0, 0.95, 0.85) * af(moon, px) * 1.2 + vec3(1.0, 0.9, 0.8) * exp(-length(mq) * 25.0) * 0.08;
  if (cheap) return c;
  vec2 cq = vec2(p.x * 1.2 + t * 0.006, p.y * 6.0);
  float cl = fbm4(cq + vec2(fbm3(cq * 0.8), 0.0) * 0.8);
  float band = smoothstep(0.04, 0.12, h) * (1.0 - smoothstep(0.30, 0.48, h));
  vec3 cc = mix(vec3(1.0, 0.64, 0.62), vec3(0.62, 0.42, 0.64), smoothstep(0.08, 0.35, h));
  c = mix(c, cc * (0.9 + 0.3 * cl), smoothstep(0.52, 0.80, cl) * band * 0.7);
  c += starfield(p, 80.0, 0.975, t, px) * smoothstep(0.32, 0.55, h) * 0.6;
  return c;
}

/* a five-storey pagoda: x = distance, y = lit windows and lanterns */
vec2 hnPagoda(vec2 p, float px, float t){
  vec2 q = p - HN_PAGODA;
  if (abs(q.x) > 0.09 || q.y < -0.03 || q.y > 0.42) return vec2(1.0, 0.0);
  float d = 1e5;
  float lit = 0.0;
  float y0 = 0.0;
  for (int i = 0; i < 5; i++){
    float fi = float(i);
    float bw = 0.034 - fi * 0.003;                 // body half width
    float bh = (i == 0 ? 0.050 : 0.036) - fi * 0.001;
    float rw = 0.074 - fi * 0.0055;                // eave half width
    // walls with a balcony rail
    d = min(d, max(abs(q.x) - bw, max(q.y - y0 - bh, y0 - q.y)));
    d = min(d, max(abs(q.x) - bw - 0.006, abs(q.y - y0 - 0.004) - 0.0016));
    // the eave: a deep curved roof, tips flicking up
    float ry = y0 + bh;
    float u = clamp(abs(q.x) / rw, 0.0, 1.0);
    float under = ry - 0.002 + 0.018 * pow(u, 3.5);
    float over = ry + 0.016 - 0.012 * u + 0.016 * pow(u, 5.0);
    d = min(d, max(abs(q.x) - rw, max(under - q.y, q.y - over)));
    // windows: a lit lattice in the middle of each storey
    vec2 wq = vec2(q.x / bw, (q.y - y0 - bh * 0.5) / bh);
    float win = max(abs(wq.x) - 0.36, abs(wq.y) - 0.22);
    float lattice = 0.45 + 0.55 * step(0.3, abs(fract(q.x * 300.0) - 0.5)) * step(0.3, abs(fract(q.y * 300.0) - 0.5));
    lit = max(lit, af(win * bw, px) * lattice * 0.75 * (0.85 + 0.15 * sin(t * 2.0 + fi)));
    // lanterns hanging from the eave tips
    for (int k = -1; k <= 1; k += 2){
      vec2 tip = vec2(float(k) * (rw - 0.003), under + 0.014 * 0.0 + 0.001);
      vec2 lp = q - tip - vec2(0.0, -0.007);
      lit = max(lit, smoothstep(0.0040, 0.0016, length(lp * vec2(1.0, 0.75))) * 1.0);
      d = min(d, max(abs(q.x - tip.x) - 0.0004, max(q.y - tip.y, tip.y - 0.004 - q.y)));
    }
    y0 = over - 0.004;
  }
  // the spire: rings and a finial
  d = min(d, max(abs(q.x) - 0.003, max(q.y - y0 - 0.085, y0 - 0.002 - q.y)));
  for (int r = 0; r < 8; r++){
    float ry = y0 + 0.014 + float(r) * 0.0075;
    d = min(d, max(abs(q.x) - 0.0072 + float(r) * 0.00035, abs(q.y - ry) - 0.0011));
  }
  d = min(d, sdCircle(q - vec2(0.0, y0 + 0.090), 0.0042));
  // stone platform and steps
  d = min(d, max(abs(q.x) - 0.060, max(q.y, -q.y - 0.02)));
  d = min(d, max(abs(q.x) - 0.075, max(q.y + 0.012, -q.y - 0.03)));
  return vec2(d, lit);
}

/* a row of blossoming trees: rounded crowns, lit on top. returns colour and coverage */
vec4 hnTrees(vec2 p, float ground, float spacing, float rMin, float rMax, float seed, float hazeAmt, vec3 haze, float px, float t, bool cheap){
  float c = floor(p.x / spacing);
  float best = 1e5;
  vec2 bc = vec2(0.0);
  float br = 1.0;
  float trunk = 1e5;
  for (int k = -1; k <= 1; k++){
    float id = c + float(k);
    float r = mix(rMin, rMax, hash11(id * 1.7 + seed));
    vec2 cc = vec2((id + 0.5 + 0.7 * (hash11(id * 3.3 + seed) - 0.5)) * spacing, ground + r * (0.75 + 0.6 * hash11(id * 5.1 + seed)));
    vec2 q = (p - cc) / vec2(1.55, 1.0);
    float a = atan(q.y, q.x);
    float bump = cheap ? 0.0 : 0.10 * n1(a * 3.0 + id * 7.0) + 0.05 * n1(a * 9.0 + id * 3.0 + t * 0.15);
    float sway = 0.002 * sin(t * 0.7 + id);
    float dd = length(q - vec2(sway, 0.0)) - r * (0.92 + bump);
    // a second lobe makes the crown cloud-like
    vec2 q2 = (p - cc - vec2(r * (hash11(id * 9.7 + seed) - 0.5) * 1.4, r * 0.30)) / vec2(1.4, 1.0);
    dd = smin(dd, length(q2) - r * 0.66, r * 0.25);
    if (dd < best){ bc = cc; br = r; }
    best = smin(best, dd, r * 0.35);
    trunk = min(trunk, sdTaper(p, vec2(cc.x + 0.01 * (hash11(id) - 0.5), ground - 0.02), cc, r * 0.12, r * 0.06));
    trunk = min(trunk, sdTaper(p, cc - vec2(0.0, r * 0.4), cc + vec2(r * 0.9 * (hash11(id * 2.0) - 0.3), r * 0.1), r * 0.06, r * 0.02));
  }
  float m = min(best, trunk);
  if (m > px * 2.0) return vec4(0.0);
  vec3 col;
  if (best <= trunk + 0.0005){
    vec2 q = (p - bc) / br;
    float lit = clamp(0.55 + 0.45 * q.y - 0.25 * q.x, 0.0, 1.0);
    vec3 deep = vec3(0.60, 0.26, 0.44), lite = vec3(1.0, 0.80, 0.86);
    col = mix(deep, lite, lit);
    if (!cheap){
      vec2 v = voronoi(p / (br * 0.16) + seed);
      float cl = smoothstep(0.8, 0.2, v.x);
      col *= 0.82 + 0.28 * cl;
      col = mix(col, deep * 0.75, (1.0 - cl) * (1.0 - lit) * 0.5);
    }
    col += vec3(1.0, 0.82, 0.86) * exp(best / (br * 0.06)) * 0.25 * lit;
  } else {
    col = vec3(0.16, 0.08, 0.10);
  }
  col = mix(col, haze, hazeAmt);
  return vec4(col, af(m, px));
}

/* everything above the water, so the pond can reflect it */
vec3 hnView(vec2 p, vec2 m, float px, float t, bool refl){
  vec2 p0 = p + m * vec2(0.005, 0.003);
  vec2 p1 = p + m * vec2(0.010, 0.005);
  vec2 p2 = p + m * vec2(0.016, 0.007);
  vec2 p3 = p + m * vec2(0.026, 0.010);
  vec3 col = hnSky(p0, px, t, refl);
  vec3 hazeC = hnSky(vec2(p1.x, HN_HZ + 0.03), px, t, true);
  // a far volcano, snow on its shoulders, pale with distance
  float fx = p1.x + 0.32;
  float fuji = HN_HZ + 0.165 - 0.62 * abs(fx) - 0.9 * fx * fx + 0.6 * abs(fx) * abs(fx) * abs(fx);
  fuji = min(fuji, HN_HZ + 0.165 - 0.004 * (1.0 - smoothstep(0.0, 0.02, abs(fx))));
  fuji = max(fuji, HN_HZ + 0.01 + 0.012 * fbm1lo(p1.x * 5.0));
  if (p1.y < fuji + px){
    float snowLine = HN_HZ + 0.115 - 0.012 * n1(p1.x * 70.0) - 0.02 * n1(p1.x * 13.0);
    float snow = smoothstep(snowLine - 0.006, snowLine, p1.y);
    vec3 fc = mix(vec3(0.60, 0.46, 0.66), vec3(1.0, 0.88, 0.88), snow);
    fc = mix(fc, hazeC, 0.42);
    col = mix(col, fc, af(p1.y - fuji, px));
  }
  float hill = HN_HZ - 0.004 + 0.045 * fbm1lo(p1.x * 2.2 + 8.0);
  col = mix(col, mix(vec3(0.42, 0.30, 0.48), hazeC, 0.5), af(p1.y - hill, px));
  // the far bank of trees
  vec4 tA = hnTrees(p1, HN_HZ - 0.03, 0.032, 0.014, 0.030, 1.0, 0.45, hazeC, px, t, refl);
  col = mix(col, tA.rgb, tA.a);
  vec4 tA2 = hnTrees(p1 + vec2(0.017, 0.0), HN_HZ - 0.05, 0.036, 0.016, 0.032, 3.0, 0.32, hazeC, px, t, refl);
  col = mix(col, tA2.rgb, tA2.a);
  // the pagoda on its rise
  float rise = HN_PAGODA.y - 0.004 - 0.25 * (p2.x - HN_PAGODA.x) * (p2.x - HN_PAGODA.x);
  col = mix(col, mix(vec3(0.30, 0.18, 0.28), hazeC, 0.25), af(p2.y - rise, px));
  vec2 pg = hnPagoda(p2, px, t);
  vec3 pc = vec3(0.13, 0.05, 0.07) + vec3(0.95, 0.5, 0.4) * exp(-abs(pg.x) * 800.0) * 0.25;
  col = mix(col, pc, af(pg.x, px));
  col += vec3(1.0, 0.52, 0.22) * pg.y * 1.3;
  col += vec3(1.0, 0.55, 0.30) * exp(-max(pg.x, 0.0) * 90.0) * 0.06;
  // nearer trees along the pond, in front of the pagoda's feet
  vec4 tB = hnTrees(p2 + vec2(0.02, 0.0), HN_WATER + 0.02, 0.058, 0.026, 0.055, 5.0, 0.10, hazeC, px, t, refl);
  col = mix(col, tB.rgb, tB.a);
  // stone lanterns on the bank
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    vec2 lq = p3 - vec2(-0.62 + fi * 0.40, HN_WATER + 0.002);
    float lan = min(min(sdBox(lq - vec2(0.0, 0.026), vec2(0.010, 0.008)), sdBox(lq - vec2(0.0, 0.040), vec2(0.018, 0.0035))), min(sdTri(lq, vec2(-0.018, 0.043), vec2(0.018, 0.043), vec2(0.0, 0.057)), sdBox(lq - vec2(0.0, 0.010), vec2(0.005, 0.012))));
    lan = min(lan, sdBox(lq - vec2(0.0, 0.001), vec2(0.012, 0.003)));
    float fl = 0.85 + 0.15 * sin(t * 5.0 + fi * 2.0);
    col = mix(col, vec3(0.13, 0.08, 0.10), af(lan, px));
    col += vec3(1.0, 0.65, 0.30) * af(sdBox(lq - vec2(0.0, 0.026), vec2(0.0065, 0.0045)), px) * 1.6 * fl;
    col += vec3(1.0, 0.55, 0.28) * exp(-length(lq - vec2(0.0, 0.026)) * 35.0) * 0.14 * fl;
  }
  return col;
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 p3 = p + m * vec2(0.026, 0.010);
  vec2 p4 = p + m * vec2(0.040, 0.014);

  vec3 col;
  float wy = HN_WATER + m.y * 0.010;
  if (p.y > wy){
    col = hnView(p, m, px, t, false);
  } else {
    // the pond: a dark mirror, stirred by a breath of wind, petals afloat
    float dy = wy - p.y;
    float z = 0.06 / (dy + 0.01);
    vec2 W = vec2(p.x * z, z);
    float rip = sin(W.y * 22.0 + t * 1.2 + sin(W.x * 6.0 + t * 0.7) * 1.5) * 0.5 + sin(W.y * 37.0 - t * 1.6 + W.x * 9.0) * 0.3;
    vec2 qm = vec2(p.x + rip * 0.005, 2.0 * wy - p.y + rip * 0.010 * (0.3 + dy * 5.0));
    vec3 refl = hnView(qm, m, px * 2.0, t, true);
    col = mix(vec3(0.025, 0.018, 0.045), refl * 0.62, 0.62 + 0.25 * smoothstep(0.25, 0.0, dy));
    col += vec3(1.0, 0.85, 0.9) * smoothstep(0.65, 1.0, rip) * 0.03;
    // drifting petals on the surface
    vec2 pq = vec2(W.x * 18.0 + t * 0.08, W.y * 14.0);
    vec2 pv = voronoi(pq);
    float petal = smoothstep(0.12, 0.05, pv.x) * step(0.82, pv.y);
    col = mix(col, vec3(1.0, 0.80, 0.86) * 0.9, petal * smoothstep(0.0, 0.05, dy));
    // a soft line where the bank meets the water
    col = mix(col, vec3(0.20, 0.10, 0.14), exp(-dy * 260.0) * 0.6);
  }

  // a branch reaching in from the top left, heavy with flowers
  float sway = 0.006 * sin(t * 0.8) + 0.003 * sin(t * 1.7);
  float br = 1e5;
  br = min(br, sdTaper(p4, vec2(-1.00, 0.46), vec2(-0.58, 0.385 + sway), 0.020, 0.011));
  br = min(br, sdTaper(p4, vec2(-0.58, 0.385 + sway), vec2(-0.22, 0.43 + sway * 1.6), 0.011, 0.004));
  br = min(br, sdTaper(p4, vec2(-0.66, 0.395 + sway), vec2(-0.46, 0.275 + sway * 1.4), 0.008, 0.003));
  br = min(br, sdTaper(p4, vec2(-0.42, 0.40 + sway * 1.2), vec2(-0.32, 0.50), 0.006, 0.002));
  col = mix(col, vec3(0.10, 0.05, 0.07), af(br, px));
  for (int i = 0; i < 10; i++){
    float fi = float(i);
    vec2 c = i < 7 ? mix(vec2(-0.82, 0.43), vec2(-0.24, 0.43 + sway * 1.6), fi / 6.0) + vec2(0.02 * sin(fi * 3.7), -0.02 + 0.028 * cos(fi * 2.3))
                   : mix(vec2(-0.62, 0.38), vec2(-0.47, 0.29 + sway * 1.4), (fi - 7.0) / 2.0) + vec2(0.0, -0.012);
    vec2 fq = p4 - c;
    float r = 0.030 + 0.012 * hash11(fi * 2.7);
    if (length(fq) > r * 1.35) continue;
    // three or four flowers per cluster
    for (int k = 0; k < 4; k++){
      float fk = float(k);
      vec2 fc = k == 0 ? vec2(0.0) : vec2(cos(fk * 2.1 + fi), sin(fk * 2.1 + fi)) * r * 0.55;
      float R = r * (k == 0 ? 0.52 : 0.40 + 0.06 * hash11(fi + fk));
      vec2 lq = rot2(fi * 1.7 + fk * 0.9 + 0.15 * sin(t * 0.9 + fi)) * (fq - fc);
      float th = atan(lq.y, lq.x);
      float a = mod(th, 1.2566) - 0.6283;
      float prof = R * (0.62 + 0.38 * cos(a * 2.2)) * (1.0 - 0.16 * exp(-a * a / 0.004));
      float fd = length(lq) - prof;
      if (fd < px * 2.0){
        float rr = length(lq) / R;
        vec3 pc = mix(vec3(0.90, 0.48, 0.62), vec3(1.0, 0.90, 0.93), smoothstep(0.15, 0.85, rr));
        pc = mix(pc, vec3(0.80, 0.30, 0.45), smoothstep(0.30, 0.0, rr) * 0.8);
        pc *= 0.92 + 0.08 * cos(a * 12.0);
        pc *= 0.85 + 0.15 * smoothstep(-R, R, lq.y);
        col = mix(col, pc, af(fd, px));
        // stamens
        float st = 1e5;
        for (int j = 0; j < 5; j++){
          float aj = float(j) * 1.2566 + 0.6;
          st = min(st, sdSeg(lq, vec2(0.0), vec2(cos(aj), sin(aj)) * R * 0.28) - R * 0.02);
        }
        col = mix(col, vec3(1.0, 0.85, 0.55), af(st, px) * 0.7);
      }
    }
  }

  // a string of paper lanterns swaying across the top right
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    float a = fi / 5.0;
    vec2 c = vec2(mix(0.02, 0.86, a), 0.44 - 0.10 * sin(3.14159 * a) + 0.004 * sin(t * 1.1 + fi));
    vec2 lq = rot2(0.06 * sin(t * 0.9 + fi * 1.3)) * (p4 - c);
    float body = sdEllipse(lq, vec2(0.016, 0.022));
    float caps = min(sdBox(lq - vec2(0.0, 0.022), vec2(0.008, 0.003)), sdBox(lq + vec2(0.0, 0.022), vec2(0.008, 0.003)));
    float fl = 0.85 + 0.15 * sin(t * 4.0 + fi * 2.1);
    vec3 lc = vec3(1.0, 0.45, 0.22) * (1.2 + 0.6 * (1.0 - length(lq / vec2(0.016, 0.022)))) * fl;
    lc *= 0.85 + 0.15 * step(0.5, fract(lq.y * 160.0));
    col = mix(col, lc, af(body, px));
    col = mix(col, vec3(0.08, 0.04, 0.05), af(caps, px));
    col += vec3(1.0, 0.45, 0.22) * exp(-length(lq) * 30.0) * 0.12 * fl;
  }
  float ax = clamp((p4.x - 0.02) / 0.84, 0.0, 1.0);
  float cord = abs(p4.y - (0.44 - 0.10 * sin(3.14159 * ax) + 0.026)) - 0.0008;
  if (p4.x > -0.04 && p4.x < 0.92) col = mix(col, vec3(0.08, 0.04, 0.05), af(cord, px) * 0.7);

  // dark grassy banks closing in at the bottom corners
  float bank = -0.50 + 0.16 * smoothstep(0.35, 0.95, abs(p3.x)) + 0.015 * fbm1lo(p3.x * 8.0);
  float grass = 1e5;
  {
    float cell = 0.006;
    float cg = floor(p3.x / cell);
    for (int k = -1; k <= 1; k++){
      float id = cg + float(k);
      float hx = (id + hash11(id)) * cell;
      float gh = 0.015 + 0.03 * hash11(id * 3.1);
      float yy = (p3.y - bank) / gh;
      if (yy < 0.0 || yy > 1.0) continue;
      float bend = (hash11(id * 7.0) - 0.5) * 0.6 + 0.2 * sin(t * 1.2 + hx * 10.0);
      grass = min(grass, abs(p3.x - hx - bend * gh * yy * yy) - cell * 0.22 * (1.0 - yy));
    }
  }
  float bk = min(p3.y - bank, grass);
  col = mix(col, vec3(0.07, 0.04, 0.07) + vec3(0.9, 0.5, 0.5) * exp(-abs(bk) * 500.0) * 0.12, af(bk, px));

  // petals drifting through the evening air
  for (int i = 0; i < 18; i++){
    float fi = float(i);
    float sp = 0.03 + 0.03 * hash11(fi * 3.3);
    vec2 pp = vec2(mod(hash11(fi) * 2.0 + t * sp * 1.4 + 1.0, 2.2) - 1.1, mod(hash11(fi * 7.1) - t * sp + 0.6, 1.2) - 0.6);
    pp.x += 0.03 * sin(t * (0.8 + hash11(fi * 5.0)) + fi);
    vec2 q = p - pp * vec2(asp / 1.6, 1.0);
    float ang = t * (1.0 + hash11(fi * 9.0) * 2.0) + fi;
    q = rot2(ang) * q;
    float s = 0.004 + 0.004 * hash11(fi * 1.7);
    float pd = sdEllipse(q, vec2(s, s * (0.45 + 0.35 * abs(sin(ang * 1.3)))));
    col = mix(col, vec3(1.0, 0.84, 0.90), af(pd, px) * 0.9);
  }

  col = filmic(col * 1.0);
  col = grade(col, vec3(0.94, 0.92, 1.10), vec3(1.04, 1.0, 0.96), 0.5);
  return col;
}`;
