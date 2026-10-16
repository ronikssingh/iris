/* Ringworld: a colossal ring rises from the horizon and arches across the sky, its far side a thread of
   continents and cloud; a pale giant planet hangs beside it; far below, rivers wind through a valley
   between tabletop mountains streaming waterfalls; a pylon of the ring's builders stands on our spur. */

export const ringworld = /* glsl */ `
const float RW_HZ = -0.040;               // horizon
const vec2 RW_C = vec2(-0.58, -1.62);     // centre of the ring's arc on screen
const float RW_R = 1.995;
const vec2 RW_SUN = vec2(0.60, 0.40);
const vec2 RW_PL = vec2(-0.40, 0.20);     // the giant planet
const float RW_PLR = 0.26;
const float RW_H = 1100.0;                // our height above the valley floor, metres

vec3 rwSky(vec2 p){
  float h = p.y - RW_HZ;
  vec3 c = mix(vec3(0.78, 0.86, 0.93), vec3(0.40, 0.60, 0.86), smoothstep(0.0, 0.28, h));
  c = mix(c, vec3(0.13, 0.27, 0.60), smoothstep(0.26, 0.68, h));
  float ds = length(p - RW_SUN);
  c += vec3(1.0, 0.95, 0.86) * (exp(-ds * 5.0) * 0.30 + exp(-ds * 22.0) * 0.55);
  c += vec3(1.0, 0.98, 0.92) * smoothstep(0.028, 0.018, ds) * 1.5;
  return c;
}

/* the giant planet: banded, a great storm, lit from the sun's side, washed pale by our daytime sky */
vec4 rwPlanet(vec2 p, vec3 sky, float t, float px){
  vec2 q = (p - RW_PL) / RW_PLR;
  float r = length(q);
  if (r > 1.02) return vec4(0.0);
  vec3 n = vec3(q, sqrt(max(1.0 - r * r, 0.0)));
  vec2 bq = rot2(0.32) * q;
  float lat = bq.y / max(n.z, 0.2) * 0.35 + bq.y * 0.65;
  float warp = fbm4(vec2(bq.x * 2.0 + t * 0.004, lat * 6.0)) - 0.5;
  float band = fbm4(vec2(lat * 10.0 + warp * 0.8, bq.x * 0.7));
  vec3 c = mix(vec3(0.88, 0.74, 0.54), vec3(0.58, 0.64, 0.68), smoothstep(0.36, 0.62, band));
  c = mix(c, vec3(0.70, 0.48, 0.34), smoothstep(0.60, 0.74, fbm4(vec2(lat * 24.0 + warp, bq.x * 1.5))) * 0.55);
  c = mix(c, vec3(0.96, 0.90, 0.80), smoothstep(0.48, 0.52, abs(fract(lat * 2.6 + warp * 0.2) - 0.5) * 2.0) * 0.25);
  vec2 sq = (bq - vec2(0.32, -0.30)) * vec2(1.0, 1.9);
  float storm = smoothstep(0.17, 0.07, length(sq));
  c = mix(c, mix(vec3(0.80, 0.46, 0.32), vec3(0.95, 0.78, 0.60), smoothstep(0.08, 0.0, length(sq))), storm * 0.8);
  vec3 L = normalize(vec3(RW_SUN - RW_PL, 0.7));
  float lit = smoothstep(-0.08, 0.40, dot(n, L));
  c *= 0.10 + 0.95 * lit;
  c += vec3(0.55, 0.72, 1.0) * pow(1.0 - n.z, 3.0) * 0.40 * lit;
  c = mix(c, sky, 0.30 + 0.25 * (1.0 - lit));
  return vec4(c, af(r - 1.0, px / RW_PLR));
}

/* the ring: an arch of land, sea and cloud between two great walls, its dark hull showing below.
   s runs from its foot on the horizon (0) up and over (1) */
vec4 rwRing(vec2 p, vec3 sky, float t, float px){
  vec2 d = p - RW_C;
  float rho = length(d);
  float a = atan(d.y, d.x);
  float s = (a - 0.92) / 0.80;              // 0 where it stands on the horizon at the right, growing as it climbs
  if (s < -0.05 || s > 1.05) return vec4(0.0);
  float w = 0.205 * exp(-s * 3.4) + 0.010;  // nearer at its foot, so wider
  float v = (rho - RW_R) / w;               // -0.5 (inner edge) .. 0.5 (outer edge)
  if (v < -0.62 || v > 0.66) return vec4(0.0);
  float L = (exp(s * 3.4) - 1.0) * 1.4 + s * 6.0;   // distance along it, in ring-widths
  vec2 mq = vec2(L, v * 1.0);
  float land = fbm4(mq * 1.3 + 4.0) + 0.28 * fbm4(mq * 4.2 + 1.0);
  vec3 sea = mix(vec3(0.14, 0.28, 0.44), vec3(0.28, 0.46, 0.58), smoothstep(0.28, 0.46, land));
  vec3 grn = mix(vec3(0.30, 0.42, 0.26), vec3(0.58, 0.54, 0.42), smoothstep(0.55, 0.85, fbm4(mq * 3.2 + 9.0)));
  grn = mix(grn, vec3(0.86, 0.86, 0.84), smoothstep(0.80, 0.92, land) * 0.75);
  vec3 c = mix(sea, grn, smoothstep(0.48, 0.52, land));
  float cl = fbm4(vec2(L * 1.7 + t * 0.012, v * 2.4) + 2.0) + 0.3 * fbm4(vec2(L * 5.0 - t * 0.01, v * 6.0));
  c = mix(c, vec3(0.96, 0.97, 0.99), smoothstep(0.55, 0.80, cl) * 0.92);
  c *= 0.82 + 0.18 * smoothstep(-0.5, 0.3, v);
  // the walls: the inner one's face in sunlight, the outer one's in its own shadow with a bright crest
  float wIn = smoothstep(-0.44, -0.49, v), wOut = smoothstep(0.44, 0.49, v);
  c = mix(c, vec3(0.88, 0.90, 0.94) * (0.9 + 0.1 * sin(L * 40.0)), wIn);
  c = mix(c, vec3(0.32, 0.36, 0.44), wOut);
  c += vec3(0.9, 0.95, 1.0) * smoothstep(0.012, 0.0, abs(v - 0.495)) * 0.6;
  // below the outer wall: the hull, dark, ribbed with the segments the ring is built from
  float hull = smoothstep(0.50, 0.53, v);
  vec3 hc = vec3(0.22, 0.25, 0.30) * (0.85 + 0.25 * smoothstep(0.9, 0.97, fract(L * 2.0)));
  hc *= 0.8 + 0.3 * smoothstep(0.72, 0.55, v);
  c = mix(c, hc, hull);
  // air: thick where its foot stands in our horizon haze, thin as it climbs, and the far reaches go blue with distance
  float haze = 0.82 * exp(-s * 6.5) + 0.55 * smoothstep(0.30, 1.0, s);
  c = mix(c, sky * vec3(0.97, 0.99, 1.04), clamp(haze, 0.0, 0.95));
  float cov = af(max(-0.5 - v, v - 0.62) * w, px);
  cov *= smoothstep(RW_HZ - 0.004, RW_HZ + 0.02, p.y);
  return vec4(c, cov);
}

/* tabletop mountain with sheer walls: distance to its silhouette (screen units) and face shading terms */
float rwMesa(vec2 p, float x0, float x1, float top, float foot, float seed){
  float tp = top + 0.008 * fbm1lo(p.x * 9.0 + seed) - 0.03 * smoothstep(x1 - 0.05, x1, p.x) - 0.03 * smoothstep(x0 + 0.05, x0, p.x);
  float side = max(x0 - p.x, p.x - x1) + 0.006 * (fbm1lo(p.y * 40.0 + seed) - 0.5);
  return max(max(p.y - tp, side), foot - p.y);
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 p0 = p + m * vec2(0.003, 0.002);

  vec3 sky = rwSky(p0);
  vec3 col = sky;
  vec4 pl = rwPlanet(p0, sky, t, px);
  col = mix(col, pl.rgb, pl.a);
  vec4 rg = rwRing(p0, sky, t, px);
  col = mix(col, rg.rgb, rg.a);
  float ci = fbm4(vec2(p0.x * 1.3 - t * 0.004, p0.y * 6.5) + 11.0);
  col = mix(col, vec3(0.94, 0.96, 1.0), smoothstep(0.58, 0.82, ci) * smoothstep(0.04, 0.22, p0.y - RW_HZ) * 0.40);

  // far ranges on the horizon, blue with air
  vec2 p1 = p + m * vec2(0.006, 0.003);
  {
    float m1 = RW_HZ + 0.018 + 0.034 * ridge1(p1.x * 3.0 + 1.0) * smoothstep(-0.9, 0.1, p1.x);
    if (p1.y < m1 + px * 2.0){
      vec3 mc = mix(vec3(0.56, 0.67, 0.82), vec3(0.74, 0.82, 0.91), smoothstep(m1, RW_HZ - 0.01, p1.y));
      col = mix(col, mc, af(p1.y - m1, px));
    }
  }

  // the valley floor, far below: forest, meadow, a winding river, lakes holding the sky, cloud shadows drifting
  vec2 p2 = p + m * vec2(0.012, 0.005);
  if (p2.y < RW_HZ){
    float z = RW_H / (RW_HZ - p2.y);
    float X = p2.x * z;
    vec2 w = vec2(X, z);
    float pw = px * z;
    float lod = smoothstep(15.0, 160.0, pw);
    float f = fbm4(w * 0.0010 + 3.0);
    float f2 = fbm4(w * 0.0050 + 7.0);
    float forest = smoothstep(0.42, 0.56, f + (f2 - 0.45) * 0.35);
    vec3 meadow = mix(vec3(0.42, 0.52, 0.22), vec3(0.60, 0.58, 0.32), smoothstep(0.55, 0.75, fbm4(w * 0.0022 + 1.0)));
    vec3 trees = vec3(0.07, 0.18, 0.09) * (0.75 + 0.5 * mix(vnoise(w * 0.03), 0.5, lod));
    vec3 c = mix(meadow, trees, forest);
    float rx = 380.0 * sin(z * 0.00082 + 0.6) + 600.0 * sin(z * 0.00029 + 2.0) - 650.0;
    float rw = 40.0 + 28.0 * sin(z * 0.0021);
    float bank = smoothstep(rw * 1.9 + pw, rw * 1.2, abs(X - rx));
    c = mix(c, vec3(0.62, 0.58, 0.44), bank * 0.6 * (1.0 - lod));
    float river = smoothstep(rw + pw * 1.5, rw - pw * 0.5, abs(X - rx));
    float lake = smoothstep(0.30, 0.275, fbm4(w * 0.0007 + 13.0));
    float water = max(river, lake);
    vec3 wc = mix(vec3(0.26, 0.44, 0.62), vec3(0.64, 0.78, 0.92), smoothstep(-0.2, 0.5, p2.x - RW_SUN.x + 0.6));
    wc += vec3(1.0, 0.96, 0.88) * exp(-abs(p2.x - RW_SUN.x + 0.05) * 5.0) * 0.45 * smoothstep(0.3, 0.7, vnoise(w * 0.02 + t * 0.2));
    c = mix(c, wc, water);
    float sh = smoothstep(0.56, 0.70, fbm4(w * 0.0010 + vec2(t * 0.012, 0.0)));
    c *= 1.0 - 0.32 * sh;
    c = mix(c, vec3(0.70, 0.79, 0.90), 1.0 - exp(-z * 0.000085));
    col = c;
    // cumulus floating between us and the valley, lit from above and on the sun side
    float zc = (RW_H - 450.0) / (RW_HZ - p2.y);
    vec2 cw = vec2(p2.x * zc, zc);
    vec2 cq = cw * 0.0013 + vec2(t * 0.012, 0.0);
    float cd = fbm4(cq) + 0.25 * fbm4(cq * 3.0);
    float cd2 = fbm4(cq + vec2(0.04, 0.03)) + 0.25 * fbm4((cq + vec2(0.04, 0.03)) * 3.0);
    float dens = smoothstep(0.66, 0.80, cd);
    vec3 cc = mix(vec3(0.66, 0.70, 0.80), vec3(1.0), clamp((cd - cd2) * 9.0 + 0.55, 0.0, 1.0));
    cc = mix(cc, vec3(0.76, 0.83, 0.92), 1.0 - exp(-zc * 0.00011));
    col = mix(col, cc, dens * 0.95);
  }

  // tabletop mountains on the left, sheer and green-crowned, rivers pouring off their edges
  vec2 p3 = p + m * vec2(0.020, 0.008);
  for (int k = 0; k < 2; k++){
    float fk = float(k);
    float x0 = k == 0 ? -0.64 : -0.92, x1 = k == 0 ? -0.24 : -0.56;
    float top = k == 0 ? -0.075 : -0.050, foot = k == 0 ? -0.255 : -0.200;
    vec2 pk = p3 + m * vec2(0.006 * fk, 0.0);
    float dm = rwMesa(pk, x0, x1, top, foot, fk * 5.0);
    if (dm < px * 2.0){
      float tp = top + 0.008 * fbm1lo(pk.x * 9.0 + fk * 5.0);
      float crown = smoothstep(tp - 0.012, tp - 0.004, pk.y);
      float u = (pk.x - x0) / (x1 - x0);
      // vertical fractures in the walls, ledges with plants, the right flank catching the sun
      vec2 wq = pk + 0.012 * vec2(gnoise(pk * 30.0), gnoise(pk * 30.0 + 5.0));
      float frac = abs(gnoise(vec2(wq.x * 55.0, wq.y * 7.0) + fk * 3.0)) + 0.45 * abs(gnoise(vec2(wq.x * 150.0, wq.y * 22.0)));
      vec3 wall = mix(vec3(0.20, 0.17, 0.15), vec3(0.50, 0.42, 0.34), smoothstep(0.10, 0.70, frac));
      wall *= 0.55 + 0.75 * smoothstep(0.70, 1.0, u);
      wall *= 0.80 + 0.30 * smoothstep(foot, tp, pk.y);
      float ledge = smoothstep(0.62, 0.72, fbm4(wq * vec2(26.0, 70.0) + fk * 7.0)) * smoothstep(0.35, 0.6, frac);
      wall = mix(wall, vec3(0.16, 0.30, 0.13) * (0.8 + 0.4 * vnoise(pk * 300.0)), ledge * 0.85);
      vec3 jungle = vec3(0.12, 0.28, 0.12) * (0.8 + 0.4 * vnoise(pk * 120.0)) + vec3(0.5, 0.6, 0.3) * smoothstep(tp - 0.003, tp, pk.y) * 0.3;
      vec3 mc = mix(wall, jungle, crown);
      mc = mix(mc, vec3(0.66, 0.75, 0.87), 0.18 + 0.20 * fk + 0.30 * smoothstep(foot + 0.06, foot, pk.y));
      col = mix(col, mc, af(dm, px));
      // the falls
      for (int j = 0; j < 2; j++){
        float fx = (k == 0 ? (j == 0 ? -0.33 : -0.47) : (j == 0 ? -0.62 : -0.80)) + 0.003 * sin(pk.y * 50.0 + fk);
        float fw = (0.006 + 0.016 * smoothstep(tp, foot, pk.y)) * (j == 0 ? 1.0 : 0.6);
        float fall = smoothstep(fw, fw * 0.3, abs(pk.x - fx)) * step(pk.y, tp + 0.001) * step(foot, pk.y);
        float streak = fbm4(vec2((pk.x - fx) * 260.0, pk.y * 22.0 + t * 2.8 + fk));
        col = mix(col, mix(vec3(0.80, 0.86, 0.92), vec3(1.0), streak), fall * (0.55 + 0.45 * streak) * af(dm, px));
        vec2 mq = (pk - vec2(fx, foot + 0.012)) / vec2(0.07, 0.035);
        float mist = exp(-dot(mq, mq)) * smoothstep(0.30, 0.75, fbm4(pk * 45.0 + vec2(0.0, -t * 0.45) + fk));
        col = mix(col, vec3(0.92, 0.95, 1.0), mist * 0.75 * (j == 0 ? 1.0 : 0.6));
      }
    }
  }

  // our spur: rock and grass at the cliff's lip, a few tall flat-crowned trees, and the builders' pylon
  vec2 p4 = p + m * vec2(0.045, 0.016);
  float edge = -0.34 + 0.08 * smoothstep(0.15, 0.85, p4.x) + 0.015 * fbm1lo(p4.x * 7.0) - 0.08 * smoothstep(-0.05, -0.75, p4.x);
  {
    float d = p4.y - edge;
    if (d < 0.05){
      // the top of our spur, running toward us: meadow grass in long sunlit streaks, rocks breaking through
      float zz = 0.06 / max(edge - p4.y + 0.012, 0.004);          // nearer as we come down the frame
      vec2 gq = vec2(p4.x * zz * 6.0, zz * 2.0);
      float gn = fbm4(gq * vec2(1.0, 0.6) + 3.0);
      vec3 grass = mix(vec3(0.15, 0.22, 0.09), vec3(0.38, 0.42, 0.18), smoothstep(0.3, 0.7, gn));
      grass = mix(grass, vec3(0.42, 0.38, 0.20), smoothstep(0.55, 0.8, fbm4(gq * 0.5 + 21.0)) * 0.5);
      grass *= 0.75 + 0.35 * vnoise(vec2(p4.x * 420.0, p4.y * 60.0));
      grass += vec3(0.9, 0.95, 0.6) * exp(-abs(d) * 160.0) * 0.18;
      float rk = smoothstep(0.66, 0.70, fbm4(gq * 0.7 + 9.0));
      vec3 rock = mix(vec3(0.30, 0.29, 0.27), vec3(0.55, 0.52, 0.47), smoothstep(0.3, 0.7, fbm4(gq * 3.0)));
      rock *= 0.7 + 0.4 * smoothstep(0.66, 0.74, fbm4(gq * 0.7 + 9.0 + vec2(0.0, 0.02)));
      vec3 gc = mix(grass, rock, rk);
      gc *= 0.62 + 0.38 * smoothstep(-0.25, 0.0, d);
      vec2 fg = p4 * vec2(240.0, 280.0);
      vec2 fid = floor(fg);
      float fl = step(0.88, hash21(fid)) * smoothstep(0.32, 0.18, length(fract(fg) - 0.5 - (hash22(fid) - 0.5) * 0.4)) * smoothstep(-0.05, -0.005, d);
      gc = mix(gc, mix(vec3(0.95, 0.85, 0.40), vec3(0.85, 0.50, 0.75), hash21(fid + 3.0)), fl * 0.85);
      float cell = 0.004;
      float cg = floor(p4.x / cell);
      float g = 1e5;
      for (int k = -1; k <= 1; k++){
        float id = cg + float(k);
        float hh = hash11(id * 1.7);
        float bx = (id + 0.5) * cell;
        float H = 0.008 + 0.028 * hh * hh;
        float yy = (p4.y - edge) / H;
        if (yy < 0.0 || yy > 1.0) continue;
        float bend = 0.25 * sin(t * 1.1 + id * 0.7) + 0.15;
        g = min(g, abs(p4.x - bx - bend * H * yy * yy) - cell * 0.25 * (1.0 - yy));
      }
      col = mix(col, gc, af(min(d, g), px));
    }
    // tall trees with flat crowns along the spur
    for (int i = 0; i < 3; i++){
      float fi = float(i);
      float tx = i == 0 ? -0.70 : (i == 1 ? -0.56 : 0.66);
      float th = i == 0 ? 0.30 : (i == 1 ? 0.22 : 0.26);
      float te = -0.34 + 0.08 * smoothstep(0.15, 0.85, tx) + 0.015 * fbm1lo(tx * 7.0) - 0.08 * smoothstep(-0.05, -0.75, tx);
      vec2 q = (p4 - vec2(tx, te)) / th;
      if (abs(q.x) > 0.6 || q.y < -0.05 || q.y > 1.12) continue;
      float trunk = sdTaper(q, vec2(0.0, 0.0), vec2(0.04 * sin(fi * 2.0), 0.80), 0.030, 0.014);
      trunk = min(trunk, sdTaper(q, vec2(0.02, 0.62), vec2(0.20, 0.86), 0.012, 0.005));
      trunk = min(trunk, sdTaper(q, vec2(0.02, 0.70), vec2(-0.18, 0.90), 0.012, 0.005));
      float D = 1.0 - length((q - vec2(0.02, 0.93)) / vec2(0.40, 0.11));
      D = max(D, 1.0 - length((q - vec2(0.20, 0.88)) / vec2(0.18, 0.07)));
      D = max(D, 1.0 - length((q - vec2(-0.20, 0.90)) / vec2(0.18, 0.07)));
      vec3 C = clump2(q * 34.0, fi);
      float F = min(C.x - 0.40 + 2.4 * D, D + 0.10);
      float pxq = px / th;
      vec3 tc = vec3(0.10, 0.08, 0.07);
      col = mix(col, tc, af(trunk, pxq));
      vec3 lc = vec3(0.10, 0.20, 0.09) * (0.8 + 0.35 * smoothstep(-0.8, 0.8, -C.z)) + vec3(0.7, 0.8, 0.4) * smoothstep(0.1, 0.0, F) * smoothstep(-0.2, 0.6, C.y) * 0.25;
      col = mix(col, lc, af(-F * 0.03, pxq));
    }
    // the pylon: a tall faceted blade of grey metal on the spur, seams of light pulsing up it
    vec2 q = p4 - vec2(0.36, -0.30);
    float pyH = 0.48;
    if (abs(q.x) < 0.08 && q.y > -0.04 && q.y < pyH + 0.02){
      float yy = q.y / pyH;
      float hw = mix(0.038, 0.011, yy) + 0.012 * step(yy, 0.10);
      float sx = q.x + 0.006 * yy;
      float dP = max(abs(sx) - hw, max(-q.y - 0.04, q.y - pyH + 0.045 * smoothstep(0.0, 0.03, sx + 0.012)));
      float facet = step(0.0, sx);
      vec3 pc = mix(vec3(0.18, 0.20, 0.24), vec3(0.56, 0.60, 0.66), facet);
      pc *= 0.82 + 0.18 * yy;
      pc += vec3(0.8, 0.85, 0.9) * smoothstep(0.003, 0.0, abs(sx - hw)) * 0.4 * facet;
      float seam = smoothstep(0.0022, 0.0, abs(sx - (facet > 0.5 ? hw * 0.45 : -hw * 0.5)));
      float pulse = smoothstep(0.85, 1.0, sin(yy * 14.0 - t * 2.2) * 0.5 + 0.5);
      pc += vec3(0.30, 0.85, 1.0) * seam * (0.35 + 1.3 * pulse);
      pc += vec3(0.30, 0.85, 1.0) * smoothstep(0.010, 0.0, abs(q.y - pyH * 0.62)) * step(abs(sx), hw) * 0.9;
      col = mix(col, pc, af(dP, px));
      col += vec3(0.30, 0.85, 1.0) * exp(-length(q - vec2(0.0, pyH * 0.62)) * 38.0) * 0.14;
    }
  }

  // a flight of great birds turning slowly over the valley
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    float ang = t * 0.10 + fi * 1.05;
    vec2 bp = vec2(0.02 + 0.15 * cos(ang), -0.12 + 0.03 * sin(ang) + 0.008 * fi);
    vec2 bq = (p2 - bp) / 0.0055;
    if (dot(bq, bq) > 4.0) continue;
    float fl = sin(t * 4.0 + fi * 2.0) * 0.45;
    float wing = min(sdSeg(bq, vec2(0.0), vec2(-0.9, 0.3 + fl)), sdSeg(bq, vec2(0.0), vec2(0.9, 0.3 + fl))) - 0.12;
    col = mix(col, vec3(0.15, 0.17, 0.20), af(wing * 0.0055, px) * 0.8);
  }

  col = filmic(col * 1.0);
  col = saturate3(col, 1.08);
  col = grade(col, vec3(0.96, 1.0, 1.06), vec3(1.04, 1.0, 0.94), 0.4);
  return col;
}`;
