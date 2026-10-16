/* Moonwake: a black-sailed galleon drifting on a calm night sea under a huge moon. */

export const moonwake = /* glsl */ `
const float MW_HZ = -0.10;
const vec2 MW_MOON = vec2(0.30, 0.105);
const float MW_MOONR = 0.155;
const vec2 MW_SHIP = vec2(0.168, -0.142);   // where the hull meets the water
const float MW_SC = 1.1;                     // ship scale

/* ---------------------------------------------------------------- the ship
   ship space: origin on the waterline amidships, bow to the left, units of screen height */
float mwHullBase(vec2 s, out float top, out float xf, out float xb){
  float x = s.x, y = s.y;
  top = 0.043
    + 0.015 * (1.0 - smoothstep(-0.078, -0.068, x))
    + 0.016 * smoothstep(0.030, 0.038, x)
    + 0.013 * smoothstep(0.072, 0.080, x)
    + 0.007 * smoothstep(0.098, 0.124, x);
  xf = -0.097 - 0.024 * smoothstep(0.0, 0.062, y);
  xb = 0.108 + 0.015 * smoothstep(0.0, 0.088, y);
  return max(max(y - top, -y - 0.04), max(xf - x, x - xb));
}
float mwHull(vec2 s){
  if (s.y > 0.096) return s.y - 0.088;
  float top, xf, xb;
  float x = s.x, y = s.y;
  float d = mwHullBase(s, top, xf, xb);
  // open balustrade along the rails
  float rail = abs(y - top - 0.0065) - 0.0009;
  float posts = max(abs(fract(x / 0.0072) - 0.5) * 0.0072 - 0.0006, abs(y - top - 0.0035) - 0.0035);
  d = min(d, max(min(rail, posts), max(xf - 0.004 - x, x - xb + 0.002)));
  // beakhead and figurehead
  if (x < -0.09) d = min(d, sdTri(s, vec2(-0.110, 0.034), vec2(-0.138, 0.050), vec2(-0.112, 0.058)));
  return d;
}
/* one square sail hanging from its yard: billowing sides, a ragged foot, a few holes */
float mwSail(vec2 s, vec4 sail, float t){
  vec2 l = s - vec2(0.0, sail.x);
  float h = sail.y, w = sail.z, seed = sail.w;
  if (abs(l.x) > w * 1.2 + 0.004 || l.y > 0.004 || l.y < -h - 0.004) return 1.0;
  float v = clamp(-l.y / h, 0.0, 1.0);
  float hw = w * (1.0 + 0.09 * v) + w * 0.07 * sin(3.14159 * v) * (1.0 + 0.35 * sin(t * 0.7 + seed));
  float u = l.x / hw;
  float fray = n1(l.x * 560.0 + seed * 37.0) - 0.5;
  float tear = pow(n1(l.x * 120.0 + seed * 13.0), 5.0);
  float foot = h * (1.0 - 0.15 * (1.0 - u * u) - 0.55 * tear) + fray * 0.0035;
  float d = max(abs(l.x) - hw, max(l.y, -l.y - foot));
  if (d > 0.003 || v < 0.2) return d;
  float hn = vnoise(l * 48.0 + seed * 17.0) * 0.62 + vnoise(l * 130.0 + seed * 5.0) * 0.38;
  return max(d, (hn - (0.86 - 0.14 * v)) / 30.0);
}
/* x = everything, y = sails only (they let a little moonlight through), z = the hull */
vec3 mwShip(vec2 s, float t){
  float x = s.x, y = s.y;
  float hull = mwHull(s);
  float d = hull;
  float sl = 1e5;
  float r = 1e5;
  float rat = abs(fract(y / 0.0062) - 0.5) * 0.0062;
  // the bow: bowsprit, forestays and jibs
  if (x < -0.054 && y > 0.03 && y < 0.27){
    d = min(d, sdTaper(s, vec2(-0.104, 0.050), vec2(-0.205, 0.098), 0.0024, 0.0011));
    r = min(r, sdSeg(s, vec2(-0.062, 0.262), vec2(-0.205, 0.098)));
    r = min(r, sdSeg(s, vec2(-0.062, 0.228), vec2(-0.150, 0.080)));
    float jb = min(sdTri(s, vec2(-0.066, 0.252), vec2(-0.196, 0.098), vec2(-0.116, 0.086)), sdTri(s, vec2(-0.066, 0.222), vec2(-0.146, 0.082), vec2(-0.088, 0.072)));
    if (jb < 0.006) jb = max(jb, (fbm3(s * 62.0 + 3.0) - 0.74) / 30.0);
    sl = min(sl, jb);
  }
  // fore mast
  if (abs(x + 0.062) < 0.07 && y > 0.03 && y < 0.28){
    d = min(d, sdTaper(s, vec2(-0.062, 0.03), vec2(-0.062, 0.272), 0.0029, 0.0011));
    d = min(d, sdBox(s - vec2(-0.062, 0.165), vec2(0.0075, 0.0018)));
    d = min(d, sdBox(s - vec2(-0.062, 0.114), vec2(0.048, 0.0013)));
    d = min(d, sdBox(s - vec2(-0.062, 0.178), vec2(0.038, 0.0012)));
    d = min(d, sdBox(s - vec2(-0.062, 0.229), vec2(0.028, 0.0011)));
    r = min(r, sdSeg(s, vec2(-0.062, 0.163), vec2(-0.082, 0.055)));
    r = min(r, sdSeg(s, vec2(-0.062, 0.163), vec2(-0.044, 0.050)));
    float span = (0.163 - y) / 0.11;
    if (y > 0.055 && y < 0.16 && abs(x + 0.062) < 0.019 * span) r = min(r, rat);
    vec4 tier = y < 0.115 ? vec4(0.112, 0.050, 0.046, 1.0) : (y < 0.179 ? vec4(0.176, 0.058, 0.036, 2.0) : vec4(0.227, 0.045, 0.026, 3.0));
    sl = min(sl, mwSail(s + vec2(0.062, 0.0), tier, t));
  }
  // main mast, with its pennant
  if (abs(x) < 0.075 && y > 0.03 && y < 0.324){
    d = min(d, sdTaper(s, vec2(0.0, 0.03), vec2(0.0, 0.312), 0.0032, 0.0012));
    d = min(d, sdBox(s - vec2(0.0, 0.186), vec2(0.0085, 0.0019)));
    d = min(d, sdBox(s - vec2(0.0, 0.124), vec2(0.055, 0.0014)));
    d = min(d, sdBox(s - vec2(0.0, 0.198), vec2(0.044, 0.0013)));
    d = min(d, sdBox(s - vec2(0.0, 0.260), vec2(0.033, 0.0012)));
    r = min(r, sdSeg(s, vec2(0.0, 0.306), vec2(-0.062, 0.248)));
    r = min(r, sdSeg(s, vec2(0.0, 0.232), vec2(-0.062, 0.166)));
    r = min(r, sdSeg(s, vec2(0.0, 0.184), vec2(-0.022, 0.046)));
    r = min(r, sdSeg(s, vec2(0.0, 0.184), vec2(0.023, 0.048)));
    float span = (0.184 - y) / 0.138;
    if (y > 0.05 && y < 0.18 && abs(x) < 0.0225 * span) r = min(r, rat);
    vec2 f = s - vec2(0.0, 0.31);
    float fl = clamp(-f.x / 0.06, 0.0, 1.0);
    float wv = 0.0035 * sin(f.x * 150.0 + t * 4.5) * fl;
    d = min(d, max(abs(f.y + wv + f.x * 0.05) - 0.0042 * (1.0 - fl * 0.8), max(f.x, -f.x - 0.06)));
    vec4 tier = y < 0.125 ? vec4(0.122, 0.058, 0.053, 4.0) : (y < 0.199 ? vec4(0.196, 0.068, 0.042, 5.0) : vec4(0.258, 0.056, 0.031, 6.0));
    sl = min(sl, mwSail(s, tier, t));
  }
  // mizzen mast: square topsails, the spanker, and the stern lantern
  if (x > 0.0 && x < 0.145 && y > 0.04 && y < 0.24){
    d = min(d, sdTaper(s, vec2(0.064, 0.06), vec2(0.064, 0.232), 0.0025, 0.0010));
    d = min(d, sdBox(s - vec2(0.064, 0.152), vec2(0.0065, 0.0016)));
    d = min(d, sdBox(s - vec2(0.064, 0.168), vec2(0.032, 0.0011)));
    d = min(d, sdBox(s - vec2(0.064, 0.212), vec2(0.023, 0.0010)));
    d = min(d, sdSeg(s, vec2(0.064, 0.150), vec2(0.116, 0.164)) - 0.0010);
    d = min(d, sdSeg(s, vec2(0.064, 0.086), vec2(0.136, 0.090)) - 0.0012);
    d = min(d, sdSeg(s, vec2(0.122, 0.082), vec2(0.124, 0.100)) - 0.0010);
    r = min(r, sdSeg(s, vec2(0.064, 0.226), vec2(0.0, 0.280)));
    r = min(r, sdSeg(s, vec2(0.064, 0.226), vec2(0.123, 0.100)));
    r = min(r, sdSeg(s, vec2(0.116, 0.164), vec2(0.124, 0.100)));
    r = min(r, sdSeg(s, vec2(0.064, 0.150), vec2(0.046, 0.062)));
    r = min(r, sdSeg(s, vec2(0.064, 0.150), vec2(0.084, 0.076)));
    vec4 tier = y < 0.169 ? vec4(0.166, 0.044, 0.030, 7.0) : vec4(0.210, 0.038, 0.021, 8.0);
    sl = min(sl, mwSail(s - vec2(0.064, 0.0), tier, t));
    float sp = min(sdTri(s, vec2(0.066, 0.148), vec2(0.066, 0.090), vec2(0.133, 0.093)), sdTri(s, vec2(0.066, 0.148), vec2(0.133, 0.093), vec2(0.114, 0.160)));
    if (sp < 0.006) sp = max(sp, (fbm3(s * 62.0 + 3.0) - 0.74) / 30.0);
    sl = min(sl, sp);
  }
  d = min(d, r - 0.00045);
  return vec3(min(d, sl), sl, hull);
}
/* a cheap, softer outline for the reflection in the water */
float mwShipLite(vec2 s){
  float top, xf, xb;
  float d = mwHullBase(s, top, xf, xb);
  d = min(d, sdBox(s - vec2(-0.062, 0.15), vec2(0.0018, 0.12)));
  d = min(d, sdBox(s - vec2(0.0, 0.17), vec2(0.0020, 0.14)));
  d = min(d, sdBox(s - vec2(0.064, 0.145), vec2(0.0016, 0.085)));
  d = min(d, sdBox(s - vec2(-0.062, 0.085), vec2(0.048, 0.027)));
  d = min(d, sdBox(s - vec2(-0.062, 0.150), vec2(0.038, 0.027)));
  d = min(d, sdBox(s - vec2(-0.062, 0.205), vec2(0.028, 0.022)));
  d = min(d, sdBox(s - vec2(0.0, 0.095), vec2(0.056, 0.027)));
  d = min(d, sdBox(s - vec2(0.0, 0.165), vec2(0.046, 0.033)));
  d = min(d, sdBox(s - vec2(0.0, 0.232), vec2(0.033, 0.026)));
  d = min(d, sdBox(s - vec2(0.064, 0.148), vec2(0.031, 0.019)));
  d = min(d, sdBox(s - vec2(0.098, 0.12), vec2(0.032, 0.028)));
  d = min(d, sdTri(s, vec2(-0.066, 0.252), vec2(-0.196, 0.098), vec2(-0.110, 0.080)));
  return d;
}

/* ------------------------------------------------------------------ the sky */
vec3 mwSky(vec2 q, float px, bool cheap){
  float h = q.y - MW_HZ;
  vec3 col = mix(vec3(0.115, 0.128, 0.185), vec3(0.028, 0.044, 0.094), smoothstep(0.0, 0.22, h));
  col = mix(col, vec3(0.004, 0.009, 0.028), smoothstep(0.18, 0.66, h));
  vec2 dq = q - MW_MOON;
  float d = length(dq);
  col += vec3(0.28, 0.36, 0.55) * 0.20 * exp(-d * 2.4);
  col += vec3(0.72, 0.80, 0.98) * 0.50 * exp(-max(d - MW_MOONR, 0.0) * 15.0);
  col += vec3(0.62, 0.70, 0.90) * 0.030 * exp(-pow((d - MW_MOONR * 2.7) * 14.0, 2.0));
  vec2 mq = dq / MW_MOONR;
  float md = d / MW_MOONR;
  if (md < 1.04){
    float disc = af(md - 1.0, px / MW_MOONR * 1.3);
    float limb = sqrt(max(0.0, 1.0 - md * md));
    vec2 sp = mq / (0.6 + 0.4 * limb);
    float mf = fbm(sp * 1.35 + vec2(11.0, 3.0));
    float maria = smoothstep(0.44, 0.62, mf) * (0.75 + 0.25 * smoothstep(0.62, 0.8, mf));
    float tex = 0.5;
    float crat = 0.0;
    if (!cheap){
      tex = fbm(sp * 7.0 + 2.0);
      vec2 v = voronoi(sp * 4.2 + 4.0);
      float big = step(0.80, v.y);
      crat = big * (smoothstep(0.22, 0.06, v.x) * 0.07 - smoothstep(0.28, 0.22, v.x) * smoothstep(0.16, 0.22, v.x) * 0.10);
      // a bright young crater with faint rays
      vec2 ty = mq - vec2(-0.18, -0.52);
      float tr = length(ty);
      crat -= exp(-tr * 40.0) * 0.35 + exp(-tr * 5.0) * 0.10 * pow(0.5 + 0.5 * sin(atan(ty.y, ty.x) * 13.0 + 1.3), 6.0);
    }
    vec3 base = vec3(1.0, 0.975, 0.93) * (0.80 + tex * 0.26) * (1.0 - maria * 0.42) * (1.0 - crat);
    base = mix(base, base * vec3(0.90, 0.95, 1.06), maria);
    base *= 0.48 + 0.52 * pow(limb, 0.4);
    col = mix(col, base * 1.25, disc);
  }
  if (cheap) return col;
  // milky way, washed out near the moon
  float washed = smoothstep(0.10, 0.62, d);
  vec2 mw = rot2(0.52) * (q - vec2(-0.40, 0.26));
  float band = exp(-pow(mw.y * 4.2, 2.0));
  if (band > 0.03){
    float dust = fbm4(mw * vec2(2.6, 7.0) + 3.0);
    col += vec3(0.11, 0.115, 0.17) * band * (0.25 + dust) * smoothstep(0.42, 0.62, dust + 0.15) * 0.6 * smoothstep(0.03, 0.25, h) * washed;
  }
  float sf = smoothstep(0.0, 0.12, h) * washed;
  if (sf > 0.001){
    col += starfield(q, 70.0, 0.955, uTime, px) * sf;
    col += starfield(q * 1.9 + 3.7, 140.0, 0.93, uTime * 1.2, px) * 0.32 * sf;
  }
  return col;
}

/* ------------------------------------------------------------------ the sea */
vec2 mwWave(vec2 W, vec2 k, float a, float w, float t, float fp){
  float lod = 1.0 - smoothstep(0.35, 1.3, length(k) * fp);
  return a * k * cos(dot(k, W) + w * t) * lod;
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 q = p + m * vec2(0.008, 0.005);              // sky
  vec2 qs = p + m * vec2(0.022, 0.010);             // ship and sea
  float hz = MW_HZ;

  // the ship rolls slowly and rises and falls on the swell
  float roll = 0.016 * sin(t * 0.52) + 0.005 * sin(t * 1.07 + 1.0);
  float bob = 0.0035 * sin(t * 0.74 + 0.4);
  vec2 shipO = MW_SHIP + vec2(0.0, bob);
  float wl = MW_SHIP.y;                             // the water line at the ship
  vec2 pivot = vec2(0.0, 0.03);
  vec2 s = rot2(roll) * (qs - shipO - pivot * MW_SC) / MW_SC + pivot;
  float pxs = px / MW_SC;

  vec3 col;
  if (qs.y >= hz){
    col = mwSky(q, px, false);
    float h = q.y - hz;
    // thin cloud streaks drifting across the moon, lit silver beside it
    float dm = length(q - MW_MOON);
    float lit = exp(-max(dm - MW_MOONR * 0.6, 0.0) * 5.0);
    vec2 cq = vec2(q.x * 1.1 + t * 0.0075, q.y * 5.2);
    float c1 = fbm(cq * 1.6 + vec2(fbm3(cq * 0.9 - t * 0.01) * 1.6, 0.0));
    float streak = smoothstep(0.54, 0.84, c1) * smoothstep(0.03, 0.12, h) * (1.0 - smoothstep(0.34, 0.52, h));
    vec3 sc = mix(vec3(0.030, 0.040, 0.068), vec3(0.62, 0.68, 0.84), lit);
    col = mix(col, sc, streak * 0.78);
    col += vec3(0.70, 0.78, 0.96) * streak * (1.0 - smoothstep(0.55, 0.84, c1)) * lit * 0.35;
    // a low cloud bank resting on the horizon, silver along its top
    float bn = fbm4(vec2(q.x * 3.2 + t * 0.004, 1.7));
    float bn2 = fbm4(vec2(q.x * 9.0 - t * 0.006, h * 30.0));
    float btop = 0.008 + 0.034 * smoothstep(0.38, 0.78, bn) + 0.010 * (bn2 - 0.5);
    float bank = 1.0 - smoothstep(btop - 0.012, btop + 0.002, h);
    float bankEdge = exp(-max(btop - h, 0.0) * 260.0) * bank;
    float nearMoon = exp(-abs(q.x - MW_MOON.x) * 3.5);
    vec3 bc = vec3(0.040, 0.050, 0.080) + vec3(0.60, 0.66, 0.84) * bankEdge * (0.10 + nearMoon * 0.60);
    col = mix(col, bc, bank * 0.88);
    // a shooting star now and then
    float cyc = floor(t / 19.0);
    float ph = t - cyc * 19.0;
    if (ph < 1.3){
      vec2 a0 = vec2(-0.75 + hash11(cyc * 3.1) * 0.8, 0.26 + hash11(cyc * 7.7) * 0.18);
      vec2 dir = normalize(vec2(1.0, -0.32 - hash11(cyc * 1.3) * 0.25));
      float k = ph / 1.3;
      vec2 head = a0 + dir * k * 0.5;
      vec2 tail = head - dir * 0.14 * sin(3.14159 * min(k * 1.4, 1.0));
      float dd = sdSeg(q, tail, head);
      float along = clamp(dot(q - tail, dir) / max(length(head - tail), 1e-4), 0.0, 1.0);
      col += vec3(0.80, 0.88, 1.0) * exp(-dd / px * 1.3) * along * along * sin(3.14159 * k) * 1.6;
    }
    // a far island on the left, palms leaning in the wind
    if (qs.x < -0.25 && h < 0.11){
      float ix = qs.x;
      float isl = hz + 0.003 + 0.034 * exp(-pow((ix + 0.55) * 6.0, 2.0)) + 0.020 * exp(-pow((ix + 0.42) * 9.0, 2.0)) + 0.009 * exp(-pow((ix + 0.66) * 11.0, 2.0)) + 0.004 * (fbm3(vec2(ix * 45.0, 2.0)) - 0.5);
      float palms = 1e5;
      for (int i = 0; i < 4; i++){
        float fi = float(i);
        vec2 b = vec2(-0.600 + fi * 0.046 + 0.008 * sin(fi * 3.1), hz + 0.027 - 0.0035 * fi);
        if (abs(qs.x - b.x) > 0.075 || qs.y < b.y - 0.004) continue;
        float lean = -0.38 + 0.24 * fi + 0.025 * sin(t * 0.5 + fi);
        float H = 0.068 - 0.010 * abs(fi - 1.4);
        vec2 c1 = b + vec2(sin(lean) * H * 0.25, H * 0.5);
        vec2 tip = b + vec2(sin(lean) * H * 0.85, H);
        palms = min(palms, min(sdTaper(qs, b, c1, 0.0017, 0.0012), sdTaper(qs, c1, tip, 0.0012, 0.0008)));
        for (int k = 0; k < 9; k++){
          float fk = float(k);
          float a = -0.55 + fk * 0.53 + 0.10 * hash11(fi * 9.0 + fk) + 0.07 * sin(t * 0.8 + fi * 1.3 + fk);
          vec2 dir = vec2(cos(a), sin(a));
          float len = 0.019 * (0.8 + 0.35 * hash11(fi * 3.0 + fk * 1.7)) * (1.0 - 0.25 * max(dir.y, 0.0));
          float droop = len * (0.55 - 0.3 * max(dir.y, 0.0));
          vec2 e1 = tip + dir * len * 0.38 + vec2(0.0, len * 0.12);
          vec2 e2 = tip + dir * len * 0.72 + vec2(0.0, len * 0.02) - vec2(0.0, droop * 0.25);
          vec2 e3 = tip + vec2(dir.x * len, dir.y * len * 0.6) - vec2(0.0, droop);
          palms = min(palms, min(sdTaper(qs, tip, e1, 0.0008, 0.0015), min(sdTaper(qs, e1, e2, 0.0015, 0.0010), sdTaper(qs, e2, e3, 0.0010, 0.0001))));
        }
      }
      float islandCov = max(af(qs.y - isl, px), af(palms, px));
      col = mix(col, vec3(0.018, 0.024, 0.042), islandCov);
    }
  } else {
    // the sea: long slow swells and fine ripples, all reflecting the moonlit sky
    float dy = max(hz - qs.y, 0.0006);
    vec3 rd = normalize(vec3(qs.x, -dy, 1.3));
    float tt = 1.0 / -rd.y;
    vec2 W = vec2(rd.x, rd.z) * tt;
    float fp = tt * tt * px * 0.9 + 0.002;
    vec2 g = vec2(0.0);
    g += mwWave(W, vec2(0.12, 0.55), 0.075, 0.55, t, fp);
    g += mwWave(W, vec2(-0.30, 0.85), 0.040, 0.78, t, fp);
    g += mwWave(W, vec2(0.55, 1.55), 0.024, 1.05, t, fp);
    g += mwWave(W, vec2(-0.95, 2.70), 0.015, 1.45, t, fp);
    g += mwWave(W, vec2(1.60, 4.80), 0.0085, 2.0, t, fp);
    g += mwWave(W, vec2(-2.70, 7.80), 0.0056, 2.6, t, fp);
    g += mwWave(W, vec2(4.30, 12.60), 0.0037, 3.2, t, fp);
    g += mwWave(W, vec2(-6.80, 19.50), 0.0025, 3.9, t, fp);
    vec2 nw = W * vec2(2.2, 4.0) + vec2(t * 0.11, t * 0.35);
    float nl = 1.0 - smoothstep(0.4, 1.4, 6.0 * fp);
    float n0 = vnoise(nw);
    g += vec2(vnoise(nw + vec2(0.05, 0.0)) - n0, vnoise(nw + vec2(0.0, 0.05)) - n0) * 0.9 * nl;
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 R = reflect(rd, n);
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
    vec2 qr = vec2(R.x / max(R.z, 0.05) * 1.3, hz + max(R.y, 0.0) / max(R.z, 0.05) * 1.3) - m * vec2(0.014, 0.005);
    vec3 refl = mwSky(qr, px * 3.0, true);
    vec3 water = vec3(0.004, 0.011, 0.020);
    col = mix(water, refl, fres);
    // hot glints where ripples face the moon, inside a soft silver path
    vec3 L = normalize(vec3(MW_MOON.x, MW_MOON.y - hz, 1.3));
    float rl = max(dot(R, L), 0.0);
    float dx = qs.x - MW_MOON.x;
    float pw = 0.035 + dy * 0.6;
    float path = exp(-dx * dx / (pw * pw));
    col += vec3(0.80, 0.86, 1.0) * (pow(rl, 3000.0) * 26.0 + pow(rl, 260.0) * 0.6) * path;
    col += vec3(0.30, 0.36, 0.50) * path * 0.05 * (1.0 - smoothstep(0.0, 0.4, dy));
    // the ship's dark reflection, broken up by the ripples
    vec2 qm = vec2(qs.x + n.x * 0.05, 2.0 * wl - qs.y + n.z * 0.06 * dy * 5.0);
    vec2 sm = rot2(roll) * (qm - shipO - pivot * MW_SC) / MW_SC + pivot;
    if (abs(sm.x) < 0.22 && sm.y < 0.27 && sm.y > -0.01){
      float rc = af(mwShipLite(sm), pxs * 3.0);
      col = mix(col, col * 0.12, rc * 0.9 * exp(-(wl - qs.y) * 6.0));
    }
    // the lanterns and stern windows trembling on the water
    vec2 lan = shipO + vec2(0.124, 0.104) * MW_SC;
    float lx = qs.x + n.x * 0.04 - lan.x;
    float lyr = (wl - qs.y) / (lan.y - wl);
    float streak = exp(-lx * lx * 7500.0) * exp(-pow(max(lyr - 0.4, 0.0) * 1.6, 2.0)) * step(0.0, lyr);
    col += vec3(1.0, 0.55, 0.22) * streak * (0.35 + 0.65 * smoothstep(0.3, 0.7, vnoise(vec2(qs.x * 300.0, W.y * 18.0 - t * 2.0)))) * 0.55;
    vec2 win = shipO + vec2(0.100, 0.058) * MW_SC;
    float wx = qs.x + n.x * 0.04 - win.x;
    float wy = (wl - qs.y) / 0.06;
    col += vec3(1.0, 0.58, 0.25) * exp(-wx * wx * 2200.0) * exp(-wy * wy * 2.0) * smoothstep(0.35, 0.75, vnoise(vec2(qs.x * 260.0, W.y * 15.0 - t * 1.6))) * 0.20;
    // haze toward the horizon
    col = mix(col, vec3(0.09, 0.105, 0.15), smoothstep(10.0, 70.0, tt) * 0.85);
  }

  // the ship itself, solid black against the moon, its edges caught by the light behind it
  if (abs(s.x) < 0.215 && s.y > -0.045 && s.y < 0.33){
    vec3 sd = mwShip(s, t);
    float hullD = sd.z;
    float below = 1.0 - af(-(qs.y - wl - 0.0012 * sin(qs.x * 140.0 + t * 1.7)), px * 0.8);
    float cov = af(sd.x, pxs) * (1.0 - below * step(hullD, sd.x + 1e-4));
    float rim = smoothstep(-0.0026, 0.0, sd.x);
    float bright = luma(col);
    vec3 dark = vec3(0.006, 0.008, 0.014);
    float isSail = step(sd.y, sd.x + 1e-5);
    vec3 shipc = dark + col * (rim * 0.55 + isSail * 0.07) + vec3(0.02, 0.025, 0.04) * bright;
    // lit windows of the stern gallery and a few gunports
    if (s.y < 0.075 && s.y > 0.012 && cov > 0.0){
      float win = 0.0;
      if (s.x > 0.08){
        for (int i = 0; i < 4; i++) win += af(sdBox(s - vec2(0.088 + float(i) * 0.0072, 0.064), vec2(0.0022, 0.0034)), pxs);
        for (int i = 0; i < 3; i++) win += af(sdBox(s - vec2(0.092 + float(i) * 0.0072, 0.050), vec2(0.0018, 0.0024)), pxs) * 0.7;
      }
      float guns = 0.0;
      if (s.y < 0.03){
        float gi = floor((s.x + 0.070) / 0.0145 + 0.5);
        if (gi >= 0.0 && gi < 9.0) guns = af(sdBox(s - vec2(-0.070 + gi * 0.0145, 0.024), vec2(0.0028, 0.0028)), pxs) * step(0.62, hash11(gi * 7.3));
      }
      float flick = 0.88 + 0.12 * sin(t * 6.3) * sin(t * 2.9 + 1.0);
      shipc += vec3(1.0, 0.56, 0.20) * (win * 1.25 + guns * 0.45) * flick;
      // wale lines catching a trace of skylight
      float wale = smoothstep(0.0012, 0.0, abs(s.y - 0.036)) + smoothstep(0.0010, 0.0, abs(s.y - 0.014));
      shipc += vec3(0.05, 0.06, 0.085) * wale * step(hullD, sd.x + 1e-4);
    }
    col = mix(col, shipc, cov);
    // foam curling at the waterline
    float fz = exp(-abs(qs.y - wl) * 420.0) * smoothstep(-0.105, -0.09, s.x) * (1.0 - smoothstep(0.10, 0.115, s.x));
    col += vec3(0.42, 0.48, 0.62) * fz * (0.35 + 0.65 * vnoise(vec2(qs.x * 220.0 - t * 1.5, 3.0))) * 0.30;
  }
  // lantern glows
  float flick2 = 0.86 + 0.14 * sin(t * 7.1) * sin(t * 3.3);
  float ld = length(s - vec2(0.124, 0.104));
  col += vec3(1.0, 0.62, 0.26) * (exp(-ld * 1000.0) * 3.2 + exp(-ld * 110.0) * 0.16) * flick2;
  float ld2 = length(s - vec2(-0.105, 0.072));
  col += vec3(1.0, 0.62, 0.26) * (exp(-ld2 * 1200.0) * 1.5 + exp(-ld2 * 140.0) * 0.07) * flick2;

  // low mist drifting over the water, silvered beneath the moon
  float mb = exp(-abs(p.y - hz - 0.006) * 22.0);
  if (mb > 0.02){
    float mn = fbm4(vec2(p.x * 2.4 - t * 0.016, p.y * 9.0 + t * 0.008));
    vec3 mistc = vec3(0.28, 0.32, 0.45) * (0.30 + 0.70 * exp(-abs(p.x - MW_MOON.x) * 2.0));
    col = mix(col, mistc, mb * smoothstep(0.40, 0.80, mn) * 0.50);
    col += vec3(0.05, 0.06, 0.09) * mb * 0.22;
  }

  col = filmic(col * 1.2);
  col = grade(col, vec3(0.90, 0.97, 1.12), vec3(1.04, 1.02, 0.97), 0.6);
  return col;
}`;
