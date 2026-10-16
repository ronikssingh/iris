/* Fimbulwinter: a frozen fjord at night, the aurora burning green in black ice, a longhouse fire, a runestone glowing. */

export const fimbulwinter = /* glsl */ `
const float FW_HZ = -0.125;

/* aurora curtains: ribbons that fold and ripple, a bright hem with rays fading up into violet */
vec3 fwAurora(vec2 p, float t){
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float x = p.x + fi * 0.37;
    float path = 0.04 + fi * 0.09 + 0.06 * sin(x * (1.7 - fi * 0.5) + t * (0.06 + fi * 0.03) + fi * 2.4) + 0.05 * (fbm1lo(x * 2.2 + t * 0.035 + fi * 5.0) - 0.5);
    float e = 0.01;
    float path2 = 0.04 + fi * 0.09 + 0.06 * sin((x + e) * (1.7 - fi * 0.5) + t * (0.06 + fi * 0.03) + fi * 2.4) + 0.05 * (fbm1lo((x + e) * 2.2 + t * 0.035 + fi * 5.0) - 0.5);
    float fold = 1.0 + 2.5 * abs(path2 - path) / e;                       // where the ribbon turns, it glows brighter
    float y = p.y - path;
    float hem = exp(-abs(y) * 120.0);
    float rise = exp(-max(y, 0.0) * (7.0 - fi * 2.0)) * smoothstep(-0.008, 0.002, y);
    float rays = 0.35 + 0.65 * pow(fbm1(x * 30.0 + t * 0.3 + fi * 9.0), 1.8);
    float span = smoothstep(-0.95, -0.55, x + fi * 0.3) * (1.0 - smoothstep(0.55, 0.95, x - fi * 0.2));
    float pulse = 0.6 + 0.4 * sin(x * 2.3 - t * 0.4 + fi * 1.7);
    vec3 c = mix(vec3(0.18, 1.0, 0.50), vec3(0.08, 0.75, 0.70), smoothstep(0.0, 0.05, y));
    c = mix(c, vec3(0.55, 0.20, 0.85), smoothstep(0.05, 0.20, y));
    acc += (c * rise * rays * 0.55 + vec3(0.6, 1.0, 0.7) * hem * 0.40) * fold * pulse * span * (1.0 - fi * 0.28);
  }
  return acc;
}

vec3 fwSky(vec2 p, float px, float t, bool cheap){
  float h = p.y - FW_HZ;
  vec3 c = mix(vec3(0.020, 0.040, 0.060), vec3(0.004, 0.008, 0.022), smoothstep(0.0, 0.55, h));
  c += fwAurora(p, t) * smoothstep(0.0, 0.08, h);
  if (!cheap) c += starfield(p, 85.0, 0.955, t, px) * smoothstep(0.03, 0.2, h) * 0.9;
  return c;
}

/* the fjord walls: height of the mountains at x */
float fwMount(float x){
  float l = 0.36 * smoothstep(-0.05, -0.70, x) + 0.07 * (ridge1(x * 3.2 + 1.0) - 0.4) * smoothstep(0.0, -0.35, x);
  float r = 0.42 * smoothstep(0.16, 0.80, x) + 0.08 * (ridge1(x * 2.8 + 7.0) - 0.4) * smoothstep(0.18, 0.5, x);
  return FW_HZ + max(l, r) + 0.002;
}
float fwFar(float x){
  return FW_HZ + 0.075 * ridge1(x * 4.0 + 3.0) * (1.0 - smoothstep(0.15, 0.6, abs(x - 0.05))) + 0.004;
}
/* snowy mountain face: a ragged cap on the ridge, snowfields and couloirs below, dark rock between */
vec3 fwRock(vec2 p, float top, float sideSign, vec3 aur){
  float depth = top - p.y;
  float cap = 0.020 + 0.045 * fbm1lo(p.x * 9.0 + 3.0) + 0.02 * n1(p.x * 41.0);
  float snowcap = smoothstep(cap + 0.006, cap - 0.006, depth);
  // snowfields: patchy, thinning out lower down
  vec2 sq = vec2(p.x * 10.0 + depth * sideSign * 6.0, p.y * 13.0);
  float field = fbm4(sq) + 0.35 * vnoise(sq * 3.7);
  float fields = smoothstep(0.66, 0.74, field + 0.30 - depth * 2.4);
  // couloirs: streaks running down the fall line
  float lane = n1((p.x + depth * sideSign * 0.9) * 34.0) * 0.6 + n1((p.x + depth * sideSign * 0.5) * 83.0) * 0.4;
  float couloir = smoothstep(0.62, 0.80, lane) * smoothstep(0.30, 0.03, depth);
  float cover = max(snowcap, max(fields, couloir * 0.8));
  vec3 rock = vec3(0.016, 0.022, 0.032) * (0.8 + 0.4 * fbm4(p * vec2(22.0, 30.0)));
  vec3 snow = (vec3(0.12, 0.18, 0.22) + aur * 0.32) * (0.85 + 0.25 * vnoise(sq * 2.0));
  return mix(rock, snow, cover);
}
/* snow-laden spruce: local units, base at origin, height 1; y = how much snow lies here */
vec2 fwSpruce(vec2 q, float seed){
  float y = q.y;
  float ty = y * (6.0 + hash11(seed) * 2.0) + hash11(seed * 3.0);
  float tier = fract(ty + 0.3 * sin(floor(ty) * 2.7 + seed));
  float jag = 0.85 + 0.25 * hash11(floor(y * 30.0) + seed * 7.0);
  float w = (1.0 - y) * 0.27 * (0.55 + 0.45 * tier) * jag + 0.010;
  float d = max(abs(q.x) - w, max(y - 1.0, -y));
  d = min(d, max(abs(q.x) - 0.03, max(y, -y - 0.08)));
  // snow piles on the upper side of each tier and along the outer tips
  float snow = smoothstep(0.80, 0.97, tier) * smoothstep(w * 0.25, w * 0.9, abs(q.x)) + smoothstep(0.94, 1.0, y) * 0.6;
  return vec2(d, clamp(snow, 0.0, 1.0));
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 p0 = p + m * vec2(0.005, 0.003);
  vec2 p1 = p + m * vec2(0.012, 0.006);
  vec2 p2 = p + m * vec2(0.024, 0.010);
  vec2 p3 = p + m * vec2(0.036, 0.013);

  vec3 col;
  vec3 auroraLight = vec3(0.10, 0.32, 0.20);       // the green cast the sky throws on the snow
  if (p1.y > FW_HZ){
    col = fwSky(p0, px, t, false);
    // the far end of the fjord, softer with distance
    float fy = fwFar(p1.x * 0.9);
    if (p1.y < fy + px){
      vec3 fc = mix(fwRock(p1 * 1.3, fy * 1.3, 1.0, auroraLight), vec3(0.05, 0.08, 0.10), 0.45);
      col = mix(col, fc, af(p1.y - fy, px));
    }
    // the fjord walls, and snow torn off their ridges by the wind
    float my = fwMount(p1.x);
    if (p1.y < my + 0.06){
      vec3 mc = fwRock(p1, my, p1.x < 0.05 ? 1.0 : -1.0, auroraLight);
      mc = mix(mc, vec3(0.04, 0.07, 0.09), smoothstep(0.05, 0.30, my - p1.y) * 0.35);
      col = mix(col, mc, af(p1.y - my, px));
      float plume = exp(-max(p1.y - my, 0.0) * 40.0) * step(my - 0.004, p1.y) * smoothstep(FW_HZ + 0.10, FW_HZ + 0.25, my);
      float wisp = smoothstep(0.45, 0.85, fbm4(vec2(p1.x * 9.0 - t * 0.35, (p1.y - my) * 40.0 - t * 0.2)));
      col += vec3(0.25, 0.40, 0.42) * plume * wisp * 0.5;
    }
  } else {
    // black ice: a dark mirror holding the aurora, cracked, dusted with snow toward the shore
    float dy = FW_HZ - p2.y;
    float z = 0.4 / (dy + 0.002);
    vec2 W = vec2(p2.x * z, z);
    vec2 cr = voronoi(W * vec2(1.4, 1.0) * 0.9);
    float crack = smoothstep(0.035, 0.0, abs(cr.x - 0.5) * 0.0 + 0.0) * 0.0;
    vec2 vv = voronoi(W * 0.8 + 3.0);
    float edge = smoothstep(0.06, 0.0, vv.x - 0.0) * 0.0;
    // cracks from the distance to cell borders (second voronoi pass approximated)
    float cell = fract(hash21(floor(W * 0.8 + 3.0)) * 7.0);
    float lines = smoothstep(0.92, 1.0, abs(fract(W.x * 1.3 + fbm4(W * 0.7) * 2.0) - 0.5) * 2.0) * 0.5;
    vec2 qm = vec2(p2.x + (fbm3(W * 2.0) - 0.5) * 0.004, 2.0 * FW_HZ - p2.y);
    vec3 refl = fwSky(qm - m * vec2(0.024, 0.0), px * 2.0, t, true);
    float rm = max(fwMount(qm.x), fwFar(qm.x * 0.9));
    refl = mix(refl, vec3(0.03, 0.045, 0.06) + auroraLight * 0.10, af(qm.y - rm, px * 2.0));
    vec3 ice = vec3(0.006, 0.012, 0.018);
    float fres = 0.70 + 0.30 * smoothstep(0.35, 0.0, dy);
    col = mix(ice, refl * 1.1, fres * 0.88);
    col += vec3(0.15, 0.30, 0.32) * lines * smoothstep(0.30, 0.02, dy) * 0.3;
    // wind-blown streaks of snow on the ice
    float drift = smoothstep(0.60, 0.72, fbm4(W * vec2(0.5, 1.2) + vec2(t * 0.01, 0.0)) + dy * 0.30 + smoothstep(0.15, 0.6, abs(p2.x - 0.05)) * 0.12);
    col = mix(col, vec3(0.12, 0.18, 0.22) + auroraLight * 0.25, drift * 0.8);
    col = mix(col, vec3(0.05, 0.09, 0.11), smoothstep(10.0, 60.0, z) * 0.7);
  }

  // the near shore: a snowbank sweeping across the bottom
  float shore = -0.40 + 0.13 * smoothstep(0.0, -0.75, p2.x) + 0.07 * smoothstep(0.30, 0.9, p2.x) + 0.012 * fbm1lo(p2.x * 6.0);
  if (p2.y < shore + px * 2.0){
    float dd = shore - p2.y;
    vec3 sc = vec3(0.13, 0.19, 0.23) * (0.85 + 0.2 * fbm4(p2 * vec2(12.0, 30.0))) + auroraLight * 0.32;
    sc += vec3(0.3, 0.45, 0.5) * exp(-dd * 300.0) * 0.2;
    col = mix(col, sc, af(p2.y - shore, px));
  }

  // pines heavy with snow along the left shore
  for (int i = 0; i < 7; i++){
    float fi = float(i);
    float tx = -0.86 + fi * 0.085 + 0.03 * sin(fi * 3.7);
    float th = 0.16 + 0.10 * hash11(fi * 2.3);
    float ground = -0.36 + 0.10 * smoothstep(0.1, -0.8, tx) - 0.004;
    vec2 tq = (p2 - vec2(tx, ground)) / th;
    if (abs(tq.x) > 0.4 || tq.y < -0.1 || tq.y > 1.05) continue;
    vec2 sp = fwSpruce(tq, fi);
    float d = sp.x * th;
    vec3 tc = mix(vec3(0.008, 0.016, 0.016), vec3(0.15, 0.22, 0.26) + auroraLight * 0.3, sp.y * 0.85);
    col = mix(col, tc, af(d, px));
  }

  // the longhouse: a long, low hall, its turf roof sagging under snow, crossed gables ending in carved heads
  vec2 L = vec2(-0.43, -0.286);
  vec2 lq = p2 - L;
  float fl = 0.80 + 0.20 * sin(t * 7.0) * sin(t * 3.1 + 1.0) + 0.05 * sin(t * 17.0);
  if (abs(lq.x) < 0.24 && lq.y > -0.02 && lq.y < 0.20){
    float walls = sdBox(lq - vec2(0.0, 0.022), vec2(0.150, 0.022));
    float u = lq.x / 0.172;
    float ridge = 0.098 - 0.010 * (1.0 - u * u);
    float roofTop = mix(0.040, ridge, clamp(1.0 - abs(u) * 0.0, 0.0, 1.0));
    // the roof: from the eaves up to the sagging ridge, rounded over
    float roof = max(abs(lq.x) - 0.172, max(lq.y - ridge + 0.035 * pow(abs(u), 6.0), 0.040 - lq.y));
    roof = min(roof, sdBox(lq - vec2(0.0, 0.043), vec2(0.176, 0.005)));
    // crossed gable boards at each end, curling into dragon heads
    float gab = 1e5;
    for (int k = -1; k <= 1; k += 2){
      float sx = float(k);
      vec2 e0 = vec2(sx * 0.170, 0.050);
      vec2 tipA = vec2(sx * 0.190, ridge + 0.020);
      vec2 tipB = vec2(sx * 0.150, ridge + 0.020);
      gab = min(gab, sdTaper(lq, vec2(sx * 0.150, ridge - 0.010), tipA, 0.0030, 0.0025));
      gab = min(gab, sdTaper(lq, vec2(sx * 0.190, ridge - 0.010), tipB, 0.0030, 0.0025));
      // the heads: a snout and a curl
      gab = min(gab, sdTaper(lq, tipA, tipA + vec2(sx * 0.010, 0.003), 0.0035, 0.002));
      gab = min(gab, abs(sdCircle(lq - tipB - vec2(-sx * 0.004, 0.003), 0.004)) - 0.0013);
    }
    float house = min(min(walls, roof), gab);
    float roofSnow = step(0.038, lq.y) * step(roof, 0.0005);
    vec3 wood = vec3(0.035, 0.024, 0.020) * (0.75 + 0.35 * step(0.5, fract(lq.x * 110.0)));
    vec3 hc = mix(wood, vec3(0.15, 0.22, 0.26) + auroraLight * 0.3, roofSnow * 0.9);
    hc = mix(hc, vec3(0.012, 0.010, 0.010), step(gab, 0.0) * step(0.0, -gab));
    // firelight: a door ajar and light between the wall planks
    float door = sdBox(lq - vec2(0.035, 0.018), vec2(0.013, 0.018));
    hc = mix(hc, vec3(1.0, 0.55, 0.18) * 1.7 * fl, af(door, px));
    float chinks = af(abs(fract(lq.x * 55.0) - 0.5) * 0.018 - 0.0005, px) * step(abs(lq.x), 0.145) * step(0.006, lq.y) * step(lq.y, 0.040);
    hc += vec3(1.0, 0.45, 0.12) * 0.22 * fl * chinks;
    col = mix(col, hc, af(house, px));
  }
  // warm light spilling onto the snow, and smoke drifting up from the roof
  col += vec3(1.0, 0.50, 0.18) * exp(-length((lq - vec2(0.035, -0.01)) * vec2(1.0, 2.6)) * 9.0) * 0.35 * fl;
  {
    vec2 sq = lq - vec2(-0.02, 0.095);
    float rise = clamp(sq.y / 0.30, 0.0, 1.0);
    float sx = sq.x - rise * rise * 0.10 - 0.012 * sin(sq.y * 30.0 - t * 1.2);
    float smoke = exp(-abs(sx) / (0.006 + rise * 0.04)) * step(0.0, sq.y) * (1.0 - rise) * smoothstep(0.35, 0.75, fbm4(vec2(sx * 30.0, sq.y * 12.0 - t * 0.5)));
    col = mix(col, vec3(0.22, 0.26, 0.28), smoke * 0.45);
  }

  // a longship frozen in at the shore: dragon prow, shields on the rail, sail furled on its yard
  vec2 S = vec2(0.10, -0.300);
  vec2 sq = (p2 - S) / 0.26;
  if (abs(sq.x) < 0.62 && sq.y > -0.08 && sq.y < 0.62){
    float hull = max(sdEllipse(sq - vec2(0.0, 0.06), vec2(0.46, 0.11)), sq.y - 0.07 - 0.25 * pow(abs(sq.x) / 0.46, 3.0));
    hull = max(hull, -sq.y - 0.01);
    // the stems sweep up into a dragon's neck at the bow and a curl at the stern
    float stem = sdTaper(sq, vec2(0.40, 0.06), vec2(0.50, 0.22), 0.020, 0.016);
    stem = min(stem, sdTaper(sq, vec2(0.50, 0.22), vec2(0.46, 0.32), 0.016, 0.022));
    stem = min(stem, sdTaper(sq, vec2(0.46, 0.32), vec2(0.53, 0.34), 0.020, 0.010));
    stem = min(stem, sdTri(sq, vec2(0.44, 0.33), vec2(0.43, 0.39), vec2(0.47, 0.34)));
    stem = min(stem, sdTaper(sq, vec2(-0.40, 0.06), vec2(-0.49, 0.20), 0.018, 0.014));
    stem = min(stem, abs(sdCircle(sq - vec2(-0.46, 0.235), 0.035)) - 0.010);
    float mast = max(abs(sq.x + 0.02) - 0.008, max(sq.y - 0.55, -sq.y));
    float yard = sdBox(sq - vec2(-0.02, 0.50), vec2(0.20, 0.006));
    float sail = sdBox(sq - vec2(-0.02, 0.475), vec2(0.18, 0.022)) - 0.01;
    float stays = min(sdSeg(sq, vec2(-0.02, 0.55), vec2(0.40, 0.08)), sdSeg(sq, vec2(-0.02, 0.55), vec2(-0.40, 0.08))) - 0.002;
    float ship = min(min(hull, stem), min(min(mast, yard), min(sail, stays)));
    vec3 shc = vec3(0.028, 0.022, 0.020) * (0.8 + 0.3 * step(0.5, fract(sq.y * 60.0)));
    // shields along the rail, rimmed with frost
    float sx = mod(sq.x + 0.03, 0.075) - 0.0375;
    float sh = length(vec2(sx, sq.y - 0.095)) - 0.030;
    float shields = max(sh, abs(sq.x) - 0.36);
    shc = mix(shc, vec3(0.05, 0.035, 0.03) * (1.0 + 0.6 * step(0.5, fract(floor((sq.x + 0.03) / 0.075) * 0.5))), af(shields * 0.26, px));
    shc += vec3(0.14, 0.2, 0.24) * af(abs(sh) * 0.26 - 0.0007, px) * step(abs(sq.x), 0.36) * 0.6;
    // snow lying along the top of the sail and the rail
    float snowLine = smoothstep(0.015, 0.0, abs(sq.y - 0.495)) * step(sail, 0.0) + smoothstep(0.012, 0.0, abs(sq.y - 0.128 + 0.25 * pow(abs(sq.x) / 0.46, 3.0) * 0.0)) * step(hull, 0.0) * step(abs(sq.x), 0.4);
    shc = mix(shc, vec3(0.15, 0.22, 0.26) + auroraLight * 0.3, clamp(snowLine, 0.0, 1.0) * 0.8);
    col = mix(col, shc, af(min(ship, shields) * 0.26, px));
  }

  // the runestone: a tall slab, snow on its shoulders, a serpent band of runes burning cold blue
  vec2 R = vec2(0.52, -0.44);
  vec2 rq = p3 - R;
  if (abs(rq.x) < 0.09 && rq.y > -0.02 && rq.y < 0.25){
    float wide = 0.050 - 0.010 * smoothstep(0.0, 0.20, rq.y);
    float stone = max(abs(rq.x + 0.004 * rq.y) - wide, -rq.y);
    stone = max(stone, length((rq - vec2(0.0, 0.16)) / vec2(1.0, 1.25)) - 0.052);
    stone = min(stone, max(abs(rq.x + 0.004 * rq.y) - wide, max(-rq.y, rq.y - 0.16)));
    stone += 0.004 * (fbm3(rq * 55.0) - 0.5);
    vec3 sc = vec3(0.030, 0.036, 0.042) * (0.7 + 0.6 * fbm4(rq * 38.0));
    sc += vec3(0.12, 0.2, 0.22) * smoothstep(0.004, 0.0, -stone) * 0.3;
    float cap = smoothstep(0.170, 0.185, rq.y + 0.012 * n1(rq.x * 70.0)) + smoothstep(0.002, 0.0, abs(rq.y - 0.0)) * 0.0;
    sc = mix(sc, vec3(0.15, 0.22, 0.26) + auroraLight * 0.3, cap);
    // the serpent band: up one side, over the top, down the other
    vec2 bq = rq - vec2(0.0, 0.095);
    float ring = abs(length(bq / vec2(0.032, 0.070)) - 1.0) * 0.032 - 0.0065;
    ring = max(ring, -(rq.y - 0.03));
    ring = max(ring, abs(atan(bq.x, bq.y)) > 2.5 ? 1.0 : -1.0);
    float ang = atan(bq.x, bq.y);
    vec2 gq = vec2(ang * 8.0, (length(bq / vec2(0.032, 0.070)) - 1.0) * 6.0);
    vec2 gc = floor(gq + vec2(0.5, 0.0));
    vec2 gl = vec2(gq.x - gc.x, gq.y);
    float h1 = hash21(gc + 9.0), h2 = hash21(gc + 19.0);
    // stave runes: an upright and one or two slanted branches
    float glyph = abs(gl.x) - 0.06;
    glyph = min(glyph, abs(gl.x - (gl.y + 0.5) * (h1 > 0.5 ? 0.6 : -0.6) * step(0.3, h2)) - 0.05);
    glyph = min(glyph, abs(gl.x + (gl.y - 0.1) * 0.7) - 0.05 + step(h2, 0.6) * 1.0);
    glyph = max(glyph, abs(gl.y) - 0.42);
    float rune = af(max(glyph * 0.004, ring), px) * step(0.03, rq.y);
    float edgeLine = af(abs(ring + 0.0065) - 0.0008, px) * step(0.03, rq.y);
    float pulse = 0.75 + 0.25 * sin(t * 1.4) + 0.08 * sin(t * 5.0);
    sc += vec3(0.30, 0.85, 1.0) * (rune * 1.9 + edgeLine * 0.7) * pulse;
    col = mix(col, sc, af(stone, px));
  }
  col += vec3(0.20, 0.65, 0.90) * exp(-length((rq - vec2(0.0, 0.09)) * vec2(1.0, 0.7)) * 9.0) * 0.12 * (0.8 + 0.2 * sin(t * 1.4));

  // snow blowing low across everything
  float sw = smoothstep(0.55, 0.9, fbm4(vec2(p.x * 3.0 - t * 0.25, p.y * 9.0 + t * 0.05)));
  col += vec3(0.30, 0.40, 0.45) * sw * smoothstep(-0.15, -0.45, p.y) * 0.12;

  col = filmic(col * 1.35);
  col = grade(col, vec3(0.88, 1.0, 1.12), vec3(1.04, 1.02, 0.96), 0.55);
  return col;
}`;
