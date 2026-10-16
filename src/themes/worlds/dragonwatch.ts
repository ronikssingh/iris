/* Dragonwatch: a fortress on a sea cliff at dusk, a dragon wheeling overhead and setting the clouds alight. */

export const dragonwatch = /* glsl */ `
const float DW_HZ = -0.215;

/* fire breath timing: 0..1 strength */
float dwFire(float t){
  float c = mod(t, 14.0);
  return smoothstep(6.0, 6.35, c) * (1.0 - smoothstep(8.6, 9.6, c)) * (0.85 + 0.15 * sin(t * 31.0) * sin(t * 17.0));
}
/* where the dragon is, which way it leans, and how its wings beat */
void dwPose(float t, out vec2 pos, out float tilt, out float wing){
  pos = vec2(-0.38 + 0.10 * sin(t * 0.13) + 0.04 * sin(t * 0.31), 0.16 + 0.045 * sin(t * 0.21 + 1.0) + 0.015 * sin(t * 0.7));
  tilt = 0.10 * cos(t * 0.21 + 1.0) - 0.05;
  float beat = t * 2.4;
  float c = mod(t, 14.0);
  float breathing = smoothstep(5.0, 5.8, c) * (1.0 - smoothstep(9.6, 10.4, c));
  float flapping = smoothstep(-0.2, 0.4, sin(t * 0.35)) * (1.0 - breathing);   // bouts of flapping, long glides
  wing = mix(0.55 + 0.06 * sin(t * 1.3), sin(beat), flapping);
}

/* ---- the dragon, in its own frame: chest at the origin, facing +x, units of body length ---- */
float dwWing(vec2 q, float w, out float bones){
  vec2 S = vec2(0.12, 0.07);
  vec2 E = S + vec2(-0.12, 0.06 + 0.30 * w);
  vec2 Wr = E + vec2(0.20, 0.10 + 0.36 * w);
  vec2 F1 = Wr + vec2(-0.62, 0.10 + 0.50 * w);
  vec2 F2 = Wr + vec2(-0.86, -0.02 + 0.18 * w);
  vec2 F3 = Wr + vec2(-0.86, -0.22 - 0.12 * w);
  vec2 H = vec2(-0.40, -0.01);
  float m = min(min(sdTri(q, S, Wr, F1), sdTri(q, S, F1, F2)), min(sdTri(q, S, F2, F3), sdTri(q, S, F3, H)));
  m = min(m, sdTri(q, S, E, Wr));
  // scalloped trailing edge between the finger tips
  vec2 c1 = (F1 + F2) * 0.5, c2 = (F2 + F3) * 0.5, c3 = (F3 + H) * 0.5;
  vec2 n1v = normalize(vec2(F2.y - F1.y, F1.x - F2.x)); n1v *= sign(dot(n1v, c1 - S));
  vec2 n2v = normalize(vec2(F3.y - F2.y, F2.x - F3.x)); n2v *= sign(dot(n2v, c2 - S));
  vec2 n3v = normalize(vec2(H.y - F3.y, F3.x - H.x));   n3v *= sign(dot(n3v, c3 - S));
  float l1 = length(F1 - F2), l2 = length(F2 - F3), l3 = length(F3 - H);
  m = max(m, -sdCircle(q - c1 - n1v * l1 * 0.62, l1 * 0.74));
  m = max(m, -sdCircle(q - c2 - n2v * l2 * 0.62, l2 * 0.74));
  m = max(m, -sdCircle(q - c3 - n3v * l3 * 0.72, l3 * 0.82));
  bones = min(min(sdTaper(q, S, E, 0.034, 0.024), sdTaper(q, E, Wr, 0.024, 0.017)), min(sdTaper(q, Wr, F1, 0.016, 0.003), min(sdTaper(q, Wr, F2, 0.011, 0.002), sdTaper(q, Wr, F3, 0.010, 0.002))));
  bones = min(bones, sdTaper(q, Wr, Wr + vec2(0.05, 0.03), 0.012, 0.002));   // the thumb claw
  return min(m, bones);
}
vec2 dwDragon(vec2 q, float t, float w, float fire, out vec2 mouth, out vec2 mouthDir){
  // body
  float d = sdTaper(q, vec2(-0.26, 0.0), vec2(0.20, 0.025), 0.092, 0.128);
  d = smin(d, sdCircle(q - vec2(-0.20, -0.01), 0.095), 0.05);
  d = smin(d, sdCircle(q - vec2(0.12, -0.02), 0.11), 0.06);
  // neck, curving up then forward; dips a little to breathe fire
  float dip = fire * 0.10;
  vec2 n0 = vec2(0.20, 0.03), n1p = vec2(0.40, 0.12 - dip * 0.3), n2 = vec2(0.60, 0.13 - dip);
  d = smin(d, min(sdTaper(q, n0, n1p, 0.085, 0.062), sdTaper(q, n1p, n2, 0.062, 0.050)), 0.05);
  // head with brow, snout and swept-back horns; the jaw drops when it breathes
  vec2 hd = normalize(vec2(1.0, -0.18 - fire * 0.35));
  vec2 hn = vec2(-hd.y, hd.x);
  vec2 tip = n2 + hd * 0.22;
  float head = sdTaper(q, n2, tip - hn * 0.005, 0.058, 0.021);
  head = smin(head, sdCircle(q - n2 - hn * 0.025 - hd * 0.03, 0.035), 0.02);
  vec2 jd = normalize(hd - hn * (0.08 + fire * 0.55));
  head = min(head, sdTaper(q, n2 - hn * 0.02, n2 - hn * 0.02 + jd * 0.16, 0.030, 0.010));
  float horns = min(sdTaper(q, n2 + hn * 0.03 - hd * 0.01, n2 + hn * 0.085 - hd * 0.13, 0.013, 0.002), sdTaper(q, n2 + hn * 0.018 - hd * 0.03, n2 + hn * 0.045 - hd * 0.16, 0.010, 0.002));
  d = smin(d, head, 0.02);
  d = min(d, horns);
  mouth = n2 + hd * 0.15 - hn * 0.025;
  mouthDir = normalize(hd - hn * (0.05 + fire * 0.25));
  // spines down the neck and back
  float sp = 1e5;
  for (int i = 0; i < 7; i++){
    float fi = float(i);
    vec2 a = mix(vec2(0.52, 0.16 - dip * 0.8), vec2(-0.30, 0.07), fi / 6.0);
    sp = min(sp, sdTri(q, a + vec2(-0.025, -0.01), a + vec2(-0.045, 0.045 - fi * 0.002), a + vec2(0.012, -0.005)));
  }
  d = min(d, sp);
  // tail sweeping behind, swaying
  float s1 = 0.03 * sin(t * 1.1), s2 = 0.06 * sin(t * 1.1 - 0.8), s3 = 0.09 * sin(t * 1.1 - 1.6), s4 = 0.11 * sin(t * 1.1 - 2.4);
  vec2 T0 = vec2(-0.26, 0.0), T1 = vec2(-0.52, -0.035 + s1), T2 = vec2(-0.80, -0.01 + s2), T3 = vec2(-1.06, -0.06 + s3), T4 = vec2(-1.28, -0.03 + s4);
  float tail = min(min(sdTaper(q, T0, T1, 0.070, 0.048), sdTaper(q, T1, T2, 0.048, 0.030)), min(sdTaper(q, T2, T3, 0.030, 0.016), sdTaper(q, T3, T4, 0.016, 0.005)));
  vec2 td = normalize(T4 - T3); vec2 tn = vec2(-td.y, td.x);
  tail = min(tail, sdTri(q, T4 - td * 0.02, T4 + td * 0.07 + tn * 0.035, T4 + td * 0.05 - tn * 0.04));
  d = smin(d, tail, 0.03);
  // hind legs tucked under, talons curled
  d = smin(d, min(sdTaper(q, vec2(-0.18, -0.04), vec2(-0.25, -0.13), 0.045, 0.025), sdTaper(q, vec2(-0.25, -0.13), vec2(-0.19, -0.17), 0.022, 0.010)), 0.03);
  // the wing: bones solid, membrane letting the light through
  float bones, bones2;
  float memb = dwWing(q, w, bones);
  float far = dwWing(q - vec2(0.06, 0.03), w * 0.92 + 0.06, bones2);
  return vec2(min(d, bones), min(memb, far));
}

/* the cliff the fortress grows out of: x = rock distance, y = top of the rock here */
vec2 dwCliff(vec2 p){
  float top = -0.040 + 0.010 * (fbm1lo(p.x * 18.0) - 0.5) + 0.012 * smoothstep(0.55, 0.9, p.x);
  float k = clamp((p.y - DW_HZ + 0.045) / (top - DW_HZ + 0.045), 0.0, 1.0);
  float left = 0.215 - 0.055 * (1.0 - k) * (1.0 - k) + 0.014 * (ridge1(p.y * 34.0) - 0.45) + 0.02 * smoothstep(0.65, 1.0, k);
  float d = max(max(left - p.x, p.y - top), DW_HZ - 0.045 - p.y);
  // a lone sea stack with its watchtower, joined by a bridge
  float stackX = 0.075 + 0.006 * (ridge1(p.y * 40.0 + 3.0) - 0.5);
  float stack = max(max(abs(p.x - stackX) - 0.028 - 0.012 * smoothstep(-0.08, DW_HZ, p.y), p.y + 0.082), DW_HZ - 0.040 - p.y);
  d = min(d, stack);
  return vec2(d, top);
}
/* the fortress: a brutal keep, tall towers, walls stepping along the rock; y = lit windows */
vec2 dwCastle(vec2 p, float top, float px){
  float x = p.x, y = p.y;
  float d = 1e5;
  float win = 0.0;
  // curtain wall following the rock, merlons along it
  float wtop = top + 0.032;
  float wall = max(max(0.235 - x, x - 0.80), max(y - wtop, top - 0.03 - y));
  float mer = max(abs(fract(x / 0.011) - 0.5) * 0.011 - 0.0032, max(y - wtop - 0.008, wtop - y));
  d = min(wall, max(mer, max(0.235 - x, x - 0.80)));
  // the keep: a massive block with corner turrets
  float keep = max(abs(x - 0.43) - 0.068, max(y - 0.125, top - y));
  float km = max(abs(fract((x - 0.43) / 0.012) - 0.5) * 0.012 - 0.0036, max(y - 0.134, 0.125 - y));
  keep = min(keep, max(km, abs(x - 0.43) - 0.068));
  for (int k = -1; k <= 1; k += 2){
    float tx = 0.43 + float(k) * 0.064;
    keep = min(keep, max(abs(x - tx) - 0.010, max(y - 0.152, top - y)));
    keep = min(keep, max(abs(x - tx) - 0.012 * (1.0 - (y - 0.152) / 0.03), max(0.150 - y, y - 0.182)));
  }
  d = min(d, keep);
  // towers: centre x, half width, shaft top, spire height (0 = battlements)
  for (int i = 0; i < 6; i++){
    vec4 T = i == 0 ? vec4(0.262, 0.016, 0.050, -0.03) :
             i == 1 ? vec4(0.318, 0.022, 0.215, -0.05) :
             i == 2 ? vec4(0.560, 0.025, 0.170, 0.0) :
             i == 3 ? vec4(0.632, 0.015, 0.098, 0.050) :
             i == 4 ? vec4(0.700, 0.019, 0.075, 0.0) :
                      vec4(0.770, 0.013, 0.040, -0.025);
    float tt = T.z;
    float tw = T.y * (1.0 + 0.12 * smoothstep(tt, top, y));
    float sh = max(abs(x - T.x) - tw, max(y - tt, top - 0.03 - y));
    if (T.w < 0.0){
      // a crown of jagged spikes, leaning outward like claws
      float sh2 = max(abs(x - T.x) - T.y * 1.15, abs(y - tt - 0.003) - 0.004);
      for (int k = -2; k <= 2; k++){
        float fk = float(k);
        float sx = T.x + fk * T.y * 0.52;
        float hgt = -T.w * (1.0 - 0.28 * abs(fk)) * (0.8 + 0.4 * hash11(fk + float(i) * 5.0));
        sh2 = min(sh2, sdTri(vec2(x, y), vec2(sx - 0.0045, tt), vec2(sx + 0.0045, tt), vec2(sx + fk * 0.004, tt + hgt)));
      }
      sh = min(sh, sh2);
    } else if (T.w > 0.0){
      float roof = max(abs(x - T.x) - T.y * 1.3 * (1.0 - (y - tt) / T.w), max(tt - 0.003 - y, y - tt - T.w));
      sh = min(sh, roof);
      // jagged pinnacles flanking the spire
      for (int k = -1; k <= 1; k += 2){
        float sx = T.x + float(k) * T.y * 1.05;
        sh = min(sh, max(abs(x - sx) - 0.0035 * (1.0 - (y - tt) / (T.w * 0.5)), max(tt - y, y - tt - T.w * 0.5)));
      }
    } else {
      float m2 = max(abs(fract((x - T.x) / 0.009) - 0.5) * 0.009 - 0.0026, max(y - (tt + 0.009), tt - y));
      sh = min(sh, max(m2, abs(x - T.x) - T.y * 1.2));
      sh = min(sh, max(abs(x - T.x) - T.y * 1.2, abs(y - tt + 0.003) - 0.003));
      sh = min(sh, max(abs(x - T.x - T.y * 0.6) - 0.006, max(y - tt - 0.03, tt - y)));   // a little watch turret
    }
    d = min(d, sh);
    // windows: narrow slits, some lit
    vec2 wq = vec2((x - T.x) / (T.y * 0.6), (y - top - 0.02) / 0.021);
    vec2 wc = floor(wq + 0.5);
    float lit = step(0.72, hash21(wc + float(i) * 13.1));
    float wbox = max(abs(wq.x - wc.x) * T.y * 0.6 - 0.0017, abs(wq.y - wc.y) * 0.021 - 0.0045);
    if (abs(wc.x) <= 1.0 && y < tt - 0.012 && y > top + 0.008 && sh < -0.001) win = max(win, af(wbox, px) * lit);
  }
  // keep windows
  vec2 kq = vec2((x - 0.43) / 0.016, (y - top - 0.03) / 0.024);
  vec2 kc = floor(kq + 0.5);
  float kb = max(abs(kq.x - kc.x) * 0.016 - 0.0022, abs(kq.y - kc.y) * 0.024 - 0.0050);
  if (abs(kc.x) <= 3.0 && y < 0.11 && y > top + 0.01) win = max(win, af(kb, px) * step(0.74, hash21(kc + 77.0)));
  // dragon statues crouching on the wall
  for (int i = 0; i < 4; i++){
    float gx = 0.27 + float(i) * 0.15;
    vec2 g = vec2(x - gx, y - wtop - 0.009);
    d = min(d, min(sdTri(g, vec2(-0.008, -0.002), vec2(0.009, -0.002), vec2(0.004, 0.014)), sdTri(g, vec2(0.002, 0.008), vec2(0.012, 0.016), vec2(0.006, 0.004))));
  }
  // the bridge to the sea stack, on arches, and the stack's tower
  float deck = max(abs(y + 0.075) - 0.004, max(0.085 - x, x - 0.225));
  float arches = max(abs(y + 0.088) - 0.012, max(0.09 - x, x - 0.22));
  arches = max(arches, -sdCircle(vec2(mod(x - 0.09, 0.033) - 0.0165, y + 0.098), 0.012));
  d = min(d, min(deck, arches));
  float st = max(abs(x - 0.075) - 0.017, max(y - 0.012, -0.085 - y));
  st = min(st, max(abs(x - 0.075) - 0.021 * (1.0 - (y - 0.012) / 0.05), max(0.010 - y, y - 0.062)));
  d = min(d, st);
  vec2 sq = vec2((x - 0.075) / 0.012, (y + 0.03) / 0.02);
  vec2 sc = floor(sq + 0.5);
  if (abs(sc.x) <= 0.0 && abs(sc.y) <= 1.0) win = max(win, af(max(abs(sq.x - sc.x) * 0.012 - 0.0017, abs(sq.y - sc.y) * 0.02 - 0.0045), px));
  return vec2(d, win);
}

/* storm clouds lit from below by the last of the dusk, and by dragon fire */
vec3 dwSky(vec2 p, float t, vec2 firePos, float fire, float px){
  float h = p.y - DW_HZ;
  vec3 c = mix(vec3(0.34, 0.36, 0.40), vec3(0.11, 0.13, 0.17), smoothstep(0.0, 0.18, h));
  c = mix(c, vec3(0.035, 0.045, 0.065), smoothstep(0.15, 0.62, h));
  // dusk glow low on the left, a thin ember line on the horizon
  float gl = exp(-length((p - vec2(-0.55, DW_HZ)) * vec2(0.8, 3.2)) * 2.4);
  c += vec3(0.85, 0.52, 0.34) * gl * 0.55 + vec3(0.95, 0.40, 0.20) * exp(-h * 70.0) * 0.25 * (0.4 + gl);
  // cloud layers
  vec2 cq = vec2(p.x * 1.3 + t * 0.010, p.y * 2.6);
  float warp = fbm3(cq * 1.1 + vec2(-t * 0.006, 0.0));
  float cd = fbm(cq * 1.7 + warp * 1.3);
  float dens = smoothstep(0.36, 0.72, cd) * smoothstep(0.02, 0.10, h);
  float under = fbm3(cq * 1.7 + warp * 1.3 + vec2(0.0, -0.18));
  float lit = clamp((cd - under) * 6.0 + 0.5, 0.0, 1.0);
  vec3 dark = mix(vec3(0.075, 0.085, 0.11), vec3(0.035, 0.04, 0.055), smoothstep(0.1, 0.55, h));
  vec3 lite = vec3(0.30, 0.32, 0.38) * (0.6 + gl * 1.4) + vec3(0.6, 0.35, 0.22) * gl * 0.5;
  vec3 cc = mix(dark, lite, lit * (0.35 + 0.65 * exp(-h * 3.0)));
  // dragon fire glowing inside the clouds
  float fd = length((p - firePos) * vec2(1.0, 1.3));
  float fl = fire * (exp(-fd * 4.5) * 1.4 + exp(-fd * 14.0) * 1.5);
  cc += vec3(1.0, 0.45, 0.12) * fl * (0.35 + 0.9 * dens) * (0.6 + 0.6 * lit);
  c += vec3(1.0, 0.42, 0.12) * fire * exp(-fd * 3.0) * 0.25;
  c = mix(c, cc, dens * 0.93);
  return c;
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 p0 = p + m * vec2(0.006, 0.004);
  vec2 p1 = p + m * vec2(0.016, 0.007);
  vec2 p2 = p + m * vec2(0.026, 0.010);

  // the dragon's pose and fire for this moment
  vec2 dPos; float dTilt, dWingA;
  dwPose(t, dPos, dTilt, dWingA);
  float fire = dwFire(t);
  const float DS = 0.175;
  vec2 dq = rot2(dTilt) * (p1 - dPos) / DS;
  vec2 mouth, mdir;
  vec2 dd = vec2(1.0);
  if (abs(dq.x + 0.3) < 1.2 && abs(dq.y - 0.1) < 1.1) dd = dwDragon(dq, t, dWingA, fire, mouth, mdir);
  else dwDragon(vec2(5.0), t, dWingA, fire, mouth, mdir);
  vec2 mouthW = dPos + rot2(-dTilt) * mouth * DS;
  vec2 mdirW = rot2(-dTilt) * mdir;
  vec2 firePos = mouthW + mdirW * 0.10;

  vec3 col;
  if (p0.y > DW_HZ){
    col = dwSky(p0, t, firePos, fire, px);
  } else {
    // a cold, heaving sea
    float dy = max(DW_HZ - p2.y, 0.0005);
    vec3 rd = normalize(vec3(p2.x, -dy, 1.25));
    float tt = 1.0 / -rd.y;
    vec2 W = vec2(rd.x, rd.z) * tt;
    float fp = tt * tt * px * 0.8 + 0.002;
    vec2 g = vec2(0.0);
    float hh = 0.0;
    for (int i = 0; i < 9; i++){
      float fi = float(i);
      float kf = 2.4 * pow(1.45, fi);
      float an = 1.5708 + (hash11(fi * 3.7 + 1.0) - 0.5) * 2.6;
      vec2 kv = vec2(cos(an), sin(an)) * kf;
      float a = (0.05 + 0.03 * fi / 8.0) / kf;
      float lod = 1.0 - smoothstep(0.3, 1.2, kf * fp);
      float ph = dot(kv, W) + t * sqrt(kf) * 1.5 + fi * 1.7;
      g += a * kv * cos(ph) * lod;
      hh += a * sin(ph) * lod;
    }
    vec2 nw = W * vec2(5.0, 7.0) + vec2(t * 0.25, t * 0.6);
    float nl = 1.0 - smoothstep(0.3, 1.2, 10.0 * fp);
    float n0 = vnoise(nw);
    g += vec2(vnoise(nw + vec2(0.05, 0.0)) - n0, vnoise(nw + vec2(0.0, 0.05)) - n0) * 1.6 * nl;
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 R = reflect(rd, n);
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
    vec2 qr = vec2(R.x / max(R.z, 0.05) * 1.25, DW_HZ + max(R.y, 0.0) / max(R.z, 0.05) * 1.25);
    float h = qr.y - DW_HZ;
    vec3 sk = mix(vec3(0.30, 0.32, 0.36), vec3(0.07, 0.08, 0.11), smoothstep(0.0, 0.3, h));
    sk += vec3(0.85, 0.52, 0.34) * exp(-length((qr - vec2(-0.55, DW_HZ)) * vec2(0.8, 3.2)) * 2.4) * 0.5;
    vec3 water = vec3(0.008, 0.016, 0.022) + vec3(0.02, 0.04, 0.05) * smoothstep(0.0, 0.06, hh);
    col = mix(water, sk, fres * 0.85);
    // fire reflected as a broken orange smear beneath the dragon
    float fx = p2.x - firePos.x - n.x * 0.1;
    col += vec3(1.0, 0.45, 0.12) * fire * exp(-fx * fx * 25.0) * exp(-dy * 5.0) * smoothstep(0.1, 0.6, fres) * 0.9;
    // whitecaps on the crests
    float cap = smoothstep(0.035, 0.06, hh + (vnoise(W * 9.0 + t * 0.3) - 0.5) * 0.03) * smoothstep(25.0, 3.0, tt);
    col = mix(col, vec3(0.50, 0.54, 0.58), cap * 0.45);
    col = mix(col, vec3(0.22, 0.23, 0.26), smoothstep(10.0, 60.0, tt));
  }

  // the cliff, the sea stack and the fortress
  if (p2.x > 0.02 && p2.y < 0.30){
    vec2 cl = dwCliff(p2);
    vec2 cs = p2.y > cl.y - 0.05 || p2.x < 0.24 ? dwCastle(p2, cl.y, px) : vec2(1.0, 0.0);
    float k = min(cl.x, cs.x);
    if (k < px * 2.0){
      // rock: basalt columns and fissures, wet sheen from the dusk
      float rx = fbm4(vec2(p2.x * 55.0, p2.y * 12.0));
      float cols = smoothstep(0.35, 0.5, abs(fract(p2.x * 70.0 + rx * 0.8) - 0.5));
      vec3 rock = vec3(0.050, 0.052, 0.062) * (0.6 + 0.6 * rx) * (0.85 + 0.25 * cols);
      rock += vec3(0.30, 0.30, 0.34) * smoothstep(0.66, 0.80, rx) * 0.12;
      rock *= 1.0 - 0.45 * smoothstep(cl.y - 0.06, DW_HZ, p2.y);
      vec3 stone = vec3(0.058, 0.058, 0.068);
      float courses = smoothstep(0.90, 1.0, fract(p2.y * 240.0));
      float joints = smoothstep(0.93, 1.0, fract(p2.x * 120.0 + floor(p2.y * 240.0) * 0.5));
      stone *= 1.0 - 0.35 * max(courses, joints);
      vec3 cc = cs.x < cl.x ? stone : rock;
      float fdist = length(p2 - firePos);
      cc += vec3(1.0, 0.45, 0.15) * fire * exp(-fdist * 2.4) * 0.45;
      cc += vec3(0.50, 0.45, 0.44) * exp(-abs(k) * 1100.0) * 0.20;
      col = mix(col, cc, af(k, px));
      float flick = 0.8 + 0.2 * sin(t * 9.0 + p2.x * 300.0) * sin(t * 4.1 + p2.y * 200.0);
      col += vec3(1.0, 0.58, 0.22) * cs.y * 1.7 * flick;
      col += vec3(1.0, 0.50, 0.18) * 0.035 * exp(-max(cs.x, 0.0) * 200.0) * smoothstep(-0.02, 0.12, p2.y - cl.y);
    }
  }
  // surf breaking at the foot of the rock
  float wl = DW_HZ - 0.045;
  if (abs(p2.y - wl) < 0.02 && p2.x > 0.02){
    vec2 cl0 = dwCliff(vec2(p2.x, wl + 0.004));
    float nearRock = smoothstep(0.03, 0.0, max(cl0.x, 0.0)) + smoothstep(0.015, 0.0, abs(cl0.x)) * 0.6;
    float wash = smoothstep(0.35, 0.75, fbm4(vec2(p2.x * 30.0 - t * 0.5, p2.y * 70.0 + t * 1.1)));
    float rise = 0.006 + 0.006 * sin(t * 0.9 + p2.x * 20.0);
    float band = smoothstep(wl - 0.012, wl, p2.y) * (1.0 - smoothstep(wl + rise * 0.3, wl + rise + 0.004, p2.y));
    col = mix(col, vec3(0.74, 0.78, 0.82), clamp(nearRock, 0.0, 1.0) * band * wash * 0.85);
  }
  // torches and braziers along the walls
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    vec2 tp = vec2(0.255 + fi * 0.085, -0.010 + 0.004 * sin(fi * 2.0));
    float fd = length((p2 - tp) * vec2(1.0, 0.8));
    float fl = 0.75 + 0.25 * sin(t * (7.0 + fi) + fi * 3.0) * sin(t * 3.3 + fi);
    col += vec3(1.0, 0.55, 0.18) * (exp(-fd * 900.0) * 2.0 + exp(-fd * 90.0) * 0.07) * fl;
  }

  // the dragon, dark against the clouds, its belly lit by its own fire
  if (min(dd.x, dd.y) < 0.05){
    float pxd = px / DS;
    float glow = fire * exp(-length(p1 - firePos) * 9.0);
    vec3 dc = vec3(0.020, 0.018, 0.022) + vec3(1.0, 0.42, 0.12) * glow * 0.9;
    // the membrane glows faintly with the light behind it
    float cw = af(dd.y, pxd);
    vec3 mc = dc + col * 0.16 + vec3(1.0, 0.40, 0.12) * fire * 0.10;
    col = mix(col, mc, cw);
    float cb = af(dd.x, pxd);
    col = mix(col, dc + vec3(0.30, 0.30, 0.34) * exp(-abs(dd.x) * 300.0) * 0.15, cb);
  }
  // the fire itself: a roaring, turbulent cone from the jaws
  if (fire > 0.01){
    vec2 fq = p1 - mouthW;
    float along = dot(fq, mdirW);
    float perp = dot(fq, vec2(-mdirW.y, mdirW.x));
    float L = 0.36 * fire;
    if (along > -0.01 && along < L * 1.4 + 0.02){
      float k = clamp(along / L, 0.0, 1.0);
      float turb = fbm4(vec2(along * 28.0 - t * 9.0, perp * 40.0 + t * 2.0));
      float r = 0.006 + k * 0.075 + (turb - 0.5) * 0.03 * k;
      float core = 1.0 - smoothstep(r * 0.15, r, abs(perp + (turb - 0.5) * 0.02 * k));
      float body = core * smoothstep(-0.01, 0.01, along) * (1.0 - smoothstep(0.75, 1.05, k + (turb - 0.5) * 0.3));
      vec3 fc = mix(vec3(1.0, 0.95, 0.75), vec3(1.0, 0.55, 0.12), smoothstep(0.0, 0.45, k + (1.0 - core) * 0.6));
      fc = mix(fc, vec3(0.75, 0.18, 0.05), smoothstep(0.5, 1.0, k));
      col += fc * body * fire * (2.4 - k * 1.2);
      // smoke curling off the end
      float kk = along / L;
      float smoke = smoothstep(0.75, 1.1, kk) * (1.0 - smoothstep(1.2, 1.4, kk)) * (1.0 - smoothstep(r * 0.6, r * 1.6, abs(perp))) * smoothstep(0.4, 0.7, turb);
      col = mix(col, vec3(0.08, 0.07, 0.07), smoke * fire * 0.4);
    }
  }

  // cold mist rolling across the water
  float mb = exp(-abs(p.y - DW_HZ - 0.01) * 26.0);
  col = mix(col, vec3(0.28, 0.30, 0.34), mb * smoothstep(0.42, 0.85, fbm4(vec2(p.x * 2.5 - t * 0.02, p.y * 9.0))) * 0.45);

  col = filmic(col * 1.15);
  col = grade(col, vec3(0.90, 0.98, 1.10), vec3(1.06, 1.0, 0.92), 0.6);
  return col;
}`;
