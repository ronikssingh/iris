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

/* the longhouse, in its own frame: base centre at the origin. returns colour and coverage */
vec4 fwHouse(vec2 q, float t, float px, float fl, vec3 aur, vec3 ground){
  float x = q.x, y = q.y;
  vec3 snowC = vec3(0.15, 0.22, 0.26) + aur * 0.30;
  vec3 woodC = vec3(0.060, 0.040, 0.030);
  // the lights: the door, two torches, two windows; firelight falls off quickly
  vec2 doorP = vec2(0.030, 0.030);
  vec2 tL = vec2(-0.008, 0.058), tR = vec2(0.068, 0.058);
  float fT1 = 0.75 + 0.25 * sin(t * 9.0) * sin(t * 4.3), fT2 = 0.75 + 0.25 * sin(t * 8.1 + 1.0) * sin(t * 5.1);
  float warm = fl * 0.9 * exp(-length((q - doorP) * vec2(1.0, 1.3)) * 18.0) + fT1 * exp(-length(q - tL) * 30.0) * 0.8 + fT2 * exp(-length(q - tR) * 30.0) * 0.8
             + fl * 0.35 * (exp(-length(q - vec2(-0.12, 0.044)) * 30.0) + exp(-length(q - vec2(0.15, 0.044)) * 30.0));
  vec3 fire = vec3(1.0, 0.52, 0.18);
  float cov = 0.0;
  vec3 c = ground;

  // ---- the roof: a great snow-laden hull, ridge dipping in the middle, ends rising
  float u = x / 0.215;
  float ridge = 0.164 + 0.020 * u * u;
  float eave = 0.074;
  float halfW = mix(0.252, 0.212, clamp((y - eave) / (ridge - eave), 0.0, 1.0));
  float roofD = max(abs(x) - halfW, max(y - ridge, eave - 0.004 - y));
  // the snow lip over the eaves, rounded, sagging between rafters
  float lip = max(abs(x) - 0.256, abs(y - eave + 0.002 + 0.002 * sin(x * 140.0)) - 0.007);
  roofD = min(roofD, lip);
  // ---- gable boards crossing at each end of the ridge, rising into carved dragon heads that look outward
  float gab = 1e5;
  for (int k = -1; k <= 1; k += 2){
    float sx = float(k);
    vec2 cross_ = vec2(sx * 0.212, ridge + 0.004);
    // the two boards: from the roof edges up through the crossing
    gab = min(gab, sdTaper(q, vec2(sx * 0.236, ridge - 0.030), cross_ + vec2(-sx * 0.012, 0.016), 0.0050, 0.0042));
    gab = min(gab, sdTaper(q, vec2(sx * 0.188, ridge - 0.030), cross_ + vec2(sx * 0.012, 0.016), 0.0050, 0.0042));
    // the neck of the outer board curves out and up; the head looks away from the house
    vec2 n0 = cross_ + vec2(sx * 0.012, 0.016);
    vec2 n1 = n0 + vec2(sx * 0.010, 0.012);
    vec2 n2 = n1 + vec2(sx * 0.004, 0.010);
    gab = min(gab, min(sdTaper(q, n0, n1, 0.0036, 0.0032), sdTaper(q, n1, n2, 0.0032, 0.0034)));
    vec2 hq = (q - n2) * vec2(sx, 1.0) / 1.25;
    float head = sdTaper(hq, vec2(0.0, 0.0), vec2(0.016, 0.002), 0.0042, 0.0024);           // skull to snout
    head = min(head, sdTri(hq, vec2(0.003, 0.0015), vec2(0.018, -0.0045), vec2(0.004, -0.0028)));  // the open lower jaw
    head = min(head, sdTri(hq, vec2(-0.002, 0.003), vec2(-0.010, 0.011), vec2(0.003, 0.0045)));   // a swept-back horn
    head = min(head, sdTri(hq, vec2(-0.004, 0.000), vec2(-0.012, 0.004), vec2(-0.002, 0.004)));   // a second, lower horn
    head = max(head, -sdCircle(hq - vec2(0.005, 0.0015), 0.0010));                              // the eye
    gab = min(gab, head * 1.25);
    // the inner board ends in a carved point
    vec2 c0 = cross_ + vec2(-sx * 0.012, 0.016);
    gab = min(gab, sdTaper(q, c0, c0 + vec2(-sx * 0.006, 0.010), 0.0036, 0.0008));
  }
  // ---- barge boards down both gable ends, and a cap of boards along the ridge
  float barge = 1e5;
  for (int k = -1; k <= 1; k += 2){
    float sx = float(k);
    barge = min(barge, sdTaper(q, vec2(sx * 0.254, eave + 0.002), vec2(sx * 0.214, ridge - 0.002), 0.0040, 0.0034));
  }
  float rcap = max(abs(y - ridge - 0.001) - 0.0055, abs(x) - 0.214);
  // ---- the smoke hole: a little louvred box on the ridge
  float louver = sdBox(q - vec2(-0.01, 0.174), vec2(0.014, 0.010));
  louver = min(louver, sdTri(q, vec2(-0.028, 0.182), vec2(0.008, 0.182), vec2(-0.010, 0.194)));

  // ---- the walls: upright staves between a sill and a wall-plate, on a stone footing
  float walls = sdBox(q - vec2(0.0, 0.041), vec2(0.228, 0.035));
  float footing = sdBox(q - vec2(0.0, 0.007), vec2(0.226, 0.007)) - 0.002;

  // ---- woodpile against the left end, barrels at the right, a block with an axe in it
  vec2 wq = q - vec2(-0.190, 0.012);
  float pile = sdBox(wq - vec2(0.0, 0.016), vec2(0.034, 0.018)) - 0.002;
  float barrels = min(sdBox(q - vec2(0.195, 0.017), vec2(0.010, 0.016)) - 0.003, sdBox(q - vec2(0.218, 0.014), vec2(0.009, 0.013)) - 0.003);
  vec2 bq = q - vec2(0.248, 0.0);
  float block = sdBox(bq - vec2(0.0, 0.007), vec2(0.009, 0.007)) - 0.002;
  float axe = min(sdSeg(bq, vec2(-0.002, 0.012), vec2(-0.016, 0.032)) - 0.0014, sdTri(bq, vec2(0.000, 0.010), vec2(0.008, 0.019), vec2(-0.006, 0.019)));

  float all_ = min(min(min(min(roofD, barge), gab), min(louver, walls)), min(min(footing, pile), min(barrels, min(block, axe))));
  if (all_ > px * 2.0) return vec4(0.0);

  // ---- shade each part, back to front
  // walls
  if (walls < px * 2.0){
    float plank = floor((x + 0.228) / 0.0086);
    float pf = fract((x + 0.228) / 0.0086);
    vec3 wc = woodC * (0.70 + 0.45 * hash11(plank * 3.7)) * (0.85 + 0.25 * fbm4(vec2(x * 300.0, y * 40.0)));
    wc *= 1.0 - 0.55 * (smoothstep(0.08, 0.0, pf) + smoothstep(0.92, 1.0, pf));            // the gaps between staves
    float beam = step(abs(y - 0.010), 0.004) + step(abs(y - 0.072), 0.004);
    wc = mix(wc, woodC * 0.55, clamp(beam, 0.0, 1.0));
    // carved door frame: posts and lintel with interlace
    vec2 dq = q - vec2(0.030, 0.0);
    float frame = max(abs(abs(dq.x) - 0.024) - 0.005, max(y - 0.064, -y));
    frame = min(frame, max(abs(dq.x) - 0.030, abs(y - 0.062) - 0.0045));
    float knot = smoothstep(0.35, 0.5, abs(sin((dq.y + abs(dq.x) * 0.6) * 520.0) * sin((dq.y - abs(dq.x) * 0.6) * 520.0)));
    wc = mix(wc, woodC * (0.9 + 0.5 * knot), af(frame, px));
    // the door: planks with iron straps, standing ajar onto the fire within
    float door = sdBox(dq - vec2(0.0, 0.028), vec2(0.019, 0.028));
    float gap = sdBox(dq - vec2(0.012, 0.028), vec2(0.007, 0.027));
    vec3 dc = woodC * (0.75 + 0.3 * step(0.5, fract(dq.x * 160.0)));
    float strap = (step(abs(dq.y - 0.014), 0.0018) + step(abs(dq.y - 0.042), 0.0018)) * step(dq.x, 0.004);
    dc = mix(dc, vec3(0.025, 0.025, 0.028), clamp(strap, 0.0, 1.0));
    wc = mix(wc, dc, af(door, px));
    wc = mix(wc, fire * (1.6 + 0.4 * sin(t * 11.0)) * fl, af(gap, px));
    // shuttered windows with light leaking through the slats
    for (int k = -1; k <= 1; k += 2){
      vec2 wn = q - vec2(k < 0 ? -0.12 : 0.15, 0.044);
      float wb = sdBox(wn, vec2(0.011, 0.010));
      float slats = step(0.5, fract(wn.y * 260.0 + 0.25));
      vec3 sh = mix(woodC * 0.7, fire * 1.3 * fl, slats * 0.8);
      wc = mix(wc, sh, af(wb, px));
      wc = mix(wc, woodC * 0.45, af(abs(wb) - 0.0016, px));
    }
    // round shields hung along the wall, painted and battered
    float sxp = x + 0.228;
    float si = floor(sxp / 0.034);
    float sxc = (si + 0.5) * 0.034 - 0.228;
    vec2 sq2 = q - vec2(sxc, 0.040);
    float skip = step(abs(sxc - 0.030), 0.040) + step(abs(sxc + 0.12), 0.02) + step(abs(sxc - 0.15), 0.02) + step(0.205, abs(sxc));
    if (skip < 0.5){
      float sd = length(sq2) - 0.0125;
      float ang = atan(sq2.y, sq2.x);
      float h1 = hash11(si * 7.1);
      vec3 paintA = h1 < 0.33 ? vec3(0.32, 0.06, 0.04) : h1 < 0.66 ? vec3(0.34, 0.24, 0.06) : vec3(0.06, 0.12, 0.20);
      vec3 paintB = vec3(0.20, 0.18, 0.15);
      float pattern = hash11(si * 3.3) < 0.5 ? step(0.0, sin(ang * 2.0 + si)) : step(0.0, sq2.x * sq2.y);
      vec3 shc = mix(paintA, paintB, pattern) * (0.8 + 0.3 * fbm4(sq2 * 300.0));
      shc = mix(shc, vec3(0.03, 0.03, 0.03), smoothstep(0.0095, 0.0115, length(sq2)));      // the iron rim
      shc = mix(shc, vec3(0.10, 0.10, 0.11), smoothstep(0.0040, 0.0030, length(sq2)));      // the boss
      shc += vec3(0.5, 0.5, 0.55) * smoothstep(0.0030, 0.0010, length(sq2 - vec2(-0.001, 0.0012))) * 0.3;
      wc = mix(wc, shc, af(sd, px));
    }
    // torches in iron brackets beside the door
    for (int k = 0; k < 2; k++){
      vec2 tp = k == 0 ? tL : tR;
      vec2 tq = q - tp;
      float br = min(sdSeg(tq, vec2(0.0, -0.012), vec2(0.0, -0.002)) - 0.0016, sdBox(tq - vec2(0.0, -0.002), vec2(0.0035, 0.0012)));
      wc = mix(wc, vec3(0.02, 0.02, 0.02), af(br, px));
    }
    vec3 lit = wc * (0.55 + 0.25) + wc * warm * 9.0 * fire;
    c = mix(c, lit, af(walls, px));
    cov = max(cov, af(walls, px));
  }
  // footing stones, snow banked against them
  if (footing < px * 2.0){
    vec2 v = voronoi(q * vec2(180.0, 260.0));
    vec3 st = vec3(0.07, 0.075, 0.08) * (0.7 + 0.5 * v.y) * (1.0 - 0.6 * smoothstep(0.12, 0.0, v.x));
    st += st * warm * 6.0 * fire;
    c = mix(c, st, af(footing, px));
    cov = max(cov, af(footing, px));
  }
  // the roof
  if (roofD < px * 2.0){
    float k = clamp((y - eave) / (ridge - eave), 0.0, 1.0);
    vec3 rc = snowC * (0.62 + 0.55 * k);
    // wind-sculpted drifts: each ridge of snow lit on top by the aurora, shadowed beneath
    float dr = fbm4(vec2(x * 18.0, y * 34.0 - x * 6.0));
    float dr2 = fbm4(vec2(x * 18.0, (y + 0.004) * 34.0 - x * 6.0));
    rc *= 0.84 + 0.26 * dr;
    rc += snowC * clamp((dr2 - dr) * 9.0, -0.4, 0.6) * 0.45;
    rc += snowC * 0.22 * smoothstep(0.55, 0.75, fbm4(vec2(x * 50.0, y * 80.0))) * k;
    // the lower courses: wooden shingles where the snow has slid away, lumps of it still caught on them
    float bare = smoothstep(0.55, 0.20, k + 0.30 * (fbm4(vec2(x * 22.0, 3.0)) - 0.5)) * smoothstep(0.0, 0.06, k);
    float row = floor((y - eave) / 0.0068);
    float sxs = (x + 0.26) / 0.0095 + 0.5 * mod(row, 2.0);
    float sf = fract(sxs), rf = fract((y - eave) / 0.0068);
    vec3 shingle = woodC * (0.75 + 0.5 * hash11(floor(sxs) * 3.1 + row * 7.7)) * (0.65 + 0.35 * smoothstep(0.0, 0.5, rf));
    shingle = mix(shingle, woodC * 0.35, smoothstep(0.10, 0.0, sf) + smoothstep(0.90, 1.0, sf));
    shingle = mix(shingle, snowC * 0.9, smoothstep(0.62, 0.72, fbm4(vec2(x * 90.0, y * 140.0))));
    rc = mix(rc, shingle, bare * 0.92);
    float turf = smoothstep(0.66, 0.74, fbm4(vec2(x * 40.0, y * 70.0))) * smoothstep(0.35, 0.0, k) * (1.0 - bare);
    rc = mix(rc, vec3(0.04, 0.045, 0.03), turf * 0.8);
    // the ridge catches the aurora light; the ends of the rafters peek out under the eaves
    rc += vec3(0.2, 0.45, 0.3) * exp(-(ridge - y) * 250.0) * 0.25;
    float rafter = step(abs(y - eave + 0.010), 0.004) * step(0.6, fract((x + 0.25) / 0.022));
    rc = mix(rc, woodC * 0.5, rafter * step(lip, 0.0) * 0.0);
    rc += rc * warm * 2.5 * fire * smoothstep(0.08, 0.06, y);
    c = mix(c, rc, af(roofD, px));
    cov = max(cov, af(roofD, px));
  }
  // barge boards and the ridge cap: dark timber edged with snow
  if (min(barge, rcap) < px * 2.0){
    float bd = min(barge, rcap);
    vec3 bc = woodC * 0.9 * (0.8 + 0.3 * fbm4(q * vec2(400.0, 60.0)));
    bc = mix(bc, snowC * (1.05 + 0.25 * fbm4(q * vec2(300.0, 90.0))), smoothstep(-0.002, 0.001, y - ridge) * step(rcap, barge));
    bc += vec3(0.2, 0.42, 0.30) * exp(-abs(bd) * 900.0) * 0.18;
    c = mix(c, bc, af(bd, px));
    cov = max(cov, af(bd, px));
  }
  // icicles hanging from the eaves
  {
    float ic = 1e5;
    float cell = 0.0065;
    float ci = floor((x + 0.25) / cell);
    for (int k = -1; k <= 1; k++){
      float id = ci + float(k);
      float cx = (id + 0.5) * cell - 0.25;
      if (abs(cx) > 0.25) continue;
      float len = 0.004 + 0.016 * pow(hash11(id * 5.3), 2.0);
      float top = eave - 0.008;
      float yy = (top - y) / len;
      if (yy < 0.0 || yy > 1.0) continue;
      ic = min(ic, abs(x - cx) - 0.0016 * (1.0 - yy));
    }
    vec3 icc = vec3(0.30, 0.42, 0.48) + aur * 0.3 + fire * warm * 3.0;
    c = mix(c, icc, af(ic, px) * 0.9);
    cov = max(cov, af(ic, px) * 0.9);
  }
  // gable dragons, dark against the sky, firelit from below
  if (gab < px * 2.0){
    vec3 gc = woodC * 0.8 + vec3(0.25, 0.35, 0.30) * exp(-abs(gab) * 900.0) * 0.4;
    c = mix(c, gc, af(gab, px));
    cov = max(cov, af(gab, px));
  }
  // the smoke-hole louver, glowing from the hearth below
  if (louver < px * 2.0){
    vec3 lc = mix(woodC, snowC, step(0.181, y));
    lc += fire * fl * step(abs(y - 0.174), 0.005) * step(abs(x + 0.01), 0.010) * step(0.5, fract(x * 300.0)) * 1.2;
    c = mix(c, lc, af(louver, px));
    cov = max(cov, af(louver, px));
  }
  // woodpile: log ends in a stack, snow on top
  if (pile < px * 2.0){
    vec2 lg = wq * vec2(1.0, 1.0) / 0.0075;
    lg.x += step(1.0, mod(floor(lg.y), 2.0)) * 0.5;
    vec2 lc2 = fract(lg) - 0.5;
    float ring = length(lc2);
    vec3 pc = mix(vec3(0.20, 0.14, 0.08), vec3(0.09, 0.06, 0.04), smoothstep(0.30, 0.46, ring));
    pc *= 0.85 + 0.15 * sin(ring * 40.0);
    pc = mix(pc, vec3(0.02, 0.015, 0.012), smoothstep(0.44, 0.50, ring));
    pc = mix(pc, snowC, smoothstep(0.026, 0.034, wq.y + 0.003 * sin(wq.x * 200.0)));
    pc += pc * warm * 4.0 * fire;
    c = mix(c, pc, af(pile, px));
    cov = max(cov, af(pile, px));
  }
  // barrels with iron hoops, snow on their lids
  if (barrels < px * 2.0){
    vec3 bc = woodC * (0.9 + 0.3 * step(0.5, fract(x * 300.0)));
    bc = mix(bc, vec3(0.03, 0.03, 0.03), step(0.7, fract(y * 120.0)) * 0.8);
    bc = mix(bc, snowC, smoothstep(0.026, 0.031, y));
    bc += bc * warm * 4.0 * fire;
    c = mix(c, bc, af(barrels, px));
    cov = max(cov, af(barrels, px));
  }
  // the chopping block and its axe
  float ba = min(block, axe);
  if (ba < px * 2.0){
    vec3 kc = block < axe ? woodC * 1.1 * (0.85 + 0.3 * step(0.5, fract(bq.y * 200.0))) : vec3(0.06, 0.06, 0.07);
    kc = mix(kc, ground, smoothstep(0.011, 0.014, bq.y) * step(block, axe));
    kc = mix(kc, woodC * 0.9, step(axe, block) * step(0.016, bq.y));
    kc += kc * warm * 4.0 * fire;
    c = mix(c, kc, af(ba, px));
    cov = max(cov, af(ba, px));
  }
  // snow drifted up against the walls and footing
  float drift = y - (0.008 + 0.010 * fbm1lo(x * 30.0 + 2.0) + 0.012 * exp(-pow((x + 0.19) * 25.0, 2.0)));
  float dcov = af(drift, px) * step(-0.02, y);
  c = mix(c, ground, dcov);
  // torch flames, alive
  for (int k = 0; k < 2; k++){
    vec2 tp = k == 0 ? tL : tR;
    float fk = k == 0 ? fT1 : fT2;
    vec2 fq2 = q - tp - vec2(0.0, 0.004);
    float flame = sdEllipse(fq2 - vec2(0.0006 * sin(t * 13.0 + float(k)), 0.0), vec2(0.0028, 0.0065 * fk));
    c = mix(c, vec3(1.0, 0.75, 0.35) * 2.0, af(flame, px) * cov);
  }
  return vec4(c, 1.0);
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
  float shore = -0.42 + 0.06 * smoothstep(0.30, -0.05, p2.x) + 0.04 * smoothstep(-0.62, -0.88, p2.x) + 0.06 * smoothstep(0.40, 0.9, p2.x) + 0.010 * fbm1lo(p2.x * 6.0);
  if (p2.y < shore + px * 2.0){
    float dd = shore - p2.y;
    vec3 sc = vec3(0.13, 0.19, 0.23) * (0.85 + 0.2 * fbm4(p2 * vec2(12.0, 30.0))) + auroraLight * 0.32;
    sc += vec3(0.3, 0.45, 0.5) * exp(-dd * 300.0) * 0.2;
    col = mix(col, sc, af(p2.y - shore, px));
  }

  // pines heavy with snow along the left shore
  for (int i = 0; i < 9; i++){
    float fi = float(i);
    float tx = i < 5 ? -0.92 + fi * 0.055 + 0.02 * sin(fi * 3.7) : 0.30 + (fi - 5.0) * 0.075;
    float th = (i < 5 ? 0.24 : 0.15) + 0.10 * hash11(fi * 2.3);
    float ground = (i < 5 ? -0.36 + 0.04 * smoothstep(-0.62, -0.88, tx) : -0.37) - 0.004;
    vec2 tq = (p2 - vec2(tx, ground)) / th;
    if (abs(tq.x) > 0.4 || tq.y < -0.1 || tq.y > 1.05) continue;
    vec2 sp = fwSpruce(tq, fi);
    float d = sp.x * th;
    vec3 tc = mix(vec3(0.008, 0.016, 0.016), vec3(0.15, 0.22, 0.26) + auroraLight * 0.3, sp.y * 0.85);
    col = mix(col, tc, af(d, px));
  }

  // the longhouse
  const float HS = 1.55;
  vec2 L = vec2(-0.21, -0.365);
  vec2 lq = (p2 - L) / HS;
  float fl = 0.80 + 0.20 * sin(t * 7.0) * sin(t * 3.1 + 1.0) + 0.05 * sin(t * 17.0);
  // warm light pooling on the snow in front of the door and under the windows
  col += vec3(1.0, 0.50, 0.18) * exp(-length((lq - vec2(0.03, -0.02)) * vec2(0.9, 2.8)) * 8.0) * 0.40 * fl;
  col += vec3(1.0, 0.50, 0.18) * exp(-length((lq - vec2(-0.12, -0.012)) * vec2(1.0, 3.0)) * 12.0) * 0.12 * fl;
  col += vec3(1.0, 0.50, 0.18) * exp(-length((lq - vec2(0.15, -0.012)) * vec2(1.0, 3.0)) * 12.0) * 0.12 * fl;
  if (abs(lq.x) < 0.31 && lq.y > -0.06 && lq.y < 0.27){
    vec4 hs = fwHouse(lq, t, px / HS, fl, auroraLight, col);
    col = mix(col, hs.rgb, hs.a);
  }
  // smoke curling up from the roof's smoke hole
  {
    vec2 sq = lq - vec2(-0.01, 0.184);
    float rise = clamp(sq.y / 0.32, 0.0, 1.0);
    float sx = sq.x - rise * rise * 0.12 - 0.012 * sin(sq.y * 28.0 - t * 1.2);
    float smoke = exp(-abs(sx) / (0.006 + rise * 0.045)) * step(0.0, sq.y) * (1.0 - rise) * smoothstep(0.35, 0.75, fbm4(vec2(sx * 30.0, sq.y * 12.0 - t * 0.5)));
    col = mix(col, vec3(0.20, 0.24, 0.27), smoke * 0.5);
    col += vec3(1.0, 0.45, 0.15) * exp(-length(sq * vec2(1.0, 1.6)) * 60.0) * 0.25 * fl;
  }

  // snow blowing low across everything
  float sw = smoothstep(0.55, 0.9, fbm4(vec2(p.x * 3.0 - t * 0.25, p.y * 9.0 + t * 0.05)));
  col += vec3(0.30, 0.40, 0.45) * sw * smoothstep(-0.15, -0.45, p.y) * 0.12;

  col = filmic(col * 1.35);
  col = grade(col, vec3(0.88, 1.0, 1.12), vec3(1.04, 1.02, 0.96), 0.55);
  return col;
}`;
