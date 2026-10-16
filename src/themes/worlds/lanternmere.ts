/* Lanternmere: arriving across a black lake by lantern boat, a towered castle glowing in the fog. */

export const lanternmere = /* glsl */ `
const float LM_HZ = -0.165;
const vec2 LM_MOON = vec2(-0.46, 0.30);

/* one tower: centre x, half width, shaft top, roof height */
vec4 lmTower(int i){
  return vec4(0.0, 0.0, 0.035, 0.0) + ( i == 0 ? vec4(-0.120, 0.013, 0.010, 0.045) :
         i == 1 ? vec4(-0.074, 0.020, 0.062, 0.070) :
         i == 2 ? vec4(-0.030, 0.015, 0.040, 0.052) :
         i == 3 ? vec4(0.030, 0.030, 0.130, 0.105) :
         i == 4 ? vec4(0.083, 0.011, 0.185, 0.080) :
         i == 5 ? vec4(0.128, 0.020, 0.095, 0.070) :
         i == 6 ? vec4(0.186, 0.025, 0.115, 0.090) :
         i == 7 ? vec4(0.246, 0.015, 0.215, 0.110) :
         i == 8 ? vec4(0.292, 0.020, 0.070, 0.060) :
         i == 9 ? vec4(0.350, 0.024, 0.105, 0.075) :
         i == 10 ? vec4(0.408, 0.014, 0.040, 0.050) :
                   vec4(0.452, 0.018, 0.012, 0.042));
}
/* the castle on its crag: x = distance, y = window light */
vec2 lmCastle(vec2 p, float px, float t){
  float x = p.x, y = p.y;
  // the crag rising out of the water
  float crag = 0.004 + 0.016 * (fbm1lo(x * 9.0 + 2.0) - 0.5) - 0.07 * smoothstep(0.32, 0.56, x) - 0.05 * (1.0 - smoothstep(-0.20, -0.10, x));
  float k = clamp((y - LM_HZ) / (crag - LM_HZ), 0.0, 1.0);
  float leftE = -0.19 - 0.025 * (1.0 - k) * (1.0 - k) + 0.024 * (ridge1(y * 30.0) - 0.45) + 0.03 * smoothstep(0.55, 0.9, k);
  float rightE = 0.50 + 0.16 * (1.0 - k) + 0.012 * (ridge1(y * 27.0 + 2.0) - 0.45) - 0.04 * smoothstep(0.6, 1.0, k);
  float rock = max(y - crag, max(leftE - x, x - rightE));
  // a ledge partway down with a cluster of trees
  float ledge = max(abs(x - 0.47) - 0.10, y - (LM_HZ + 0.07 + 0.01 * fbm1lo(x * 30.0)));
  rock = min(rock, max(ledge, LM_HZ - y));
  rock = min(rock, pineRow(p, LM_HZ + 0.065, 0.007, 0.012, 0.030, 5.0) + step(0.58, x) + step(x, 0.39));
  float d = rock;
  float win = 0.0;
  // halls with pitched roofs
  for (int i = 0; i < 3; i++){
    vec4 H = i == 0 ? vec4(-0.035, 0.040, 0.050, 0.032) : i == 1 ? vec4(0.218, 0.052, 0.078, 0.040) : vec4(0.392, 0.050, 0.040, 0.030);
    float hb = max(abs(x - H.x) - H.y, max(y - H.z, crag - 0.01 - y));
    float rf = max(abs(x - H.x) - H.y * (1.0 - (y - H.z) / H.w), max(H.z - y, y - H.z - H.w));
    d = min(d, min(hb, rf));
    // tall arched windows
    vec2 wq = vec2((x - H.x) / 0.016, (y - crag - 0.014) / 0.026);
    vec2 wc = floor(wq + vec2(0.5, 0.0));
    vec2 wl = vec2(wq.x - wc.x, wq.y - wc.y);
    float arch = max(abs(wl.x) * 0.016 - 0.0026, max(-wl.y * 0.026, wl.y * 0.026 - 0.015 - 0.0026 * (1.0 - wl.x * wl.x * 4.0)));
    if (abs(x - H.x) < H.y - 0.006 && y < H.z - 0.004 && y > crag) win = max(win, af(arch, px) * (0.25 + 0.5 * step(0.4, hash21(wc + float(i) * 7.0))));
  }
  // the towers and their pointed roofs
  for (int i = 0; i < 12; i++){
    vec4 T = lmTower(i);
    if (abs(x - T.x) > T.y * 1.6 + 0.01) continue;
    float base = crag - 0.02;
    float sh = max(abs(x - T.x) - T.y, max(y - T.z, base - y));
    float rh = T.w;
    float rf = max(abs(x - T.x) - T.y * 1.22 * pow(max(1.0 - (y - T.z) / rh, 0.0), 1.15), max(T.z - 0.002 - y, y - T.z - rh));
    // a little balcony ring under the roof
    rf = min(rf, max(abs(x - T.x) - T.y * 1.3, abs(y - T.z + 0.002) - 0.0025));
    float tw = min(sh, rf);
    // a flag on the tallest roofs
    if (T.w > 0.085){
      vec2 f = vec2(x - T.x, y - T.z - rh);
      float fw = 0.0025 * sin(f.x * 300.0 - t * 5.0);
      tw = min(tw, max(abs(f.x) - 0.0007, max(-f.y, f.y - 0.022)));
      tw = min(tw, max(abs(f.y - 0.017 + fw) - 0.004, max(-f.x, f.x - 0.020)));
    }
    d = min(d, tw);
    // windows
    vec2 wq = vec2((x - T.x) / (T.y * 0.62), (y - base) / 0.017);
    vec2 wc = floor(wq + 0.5);
    float lit = step(0.62, hash21(wc + float(i) * 17.3));
    float wbox = max(abs(wq.x - wc.x) * T.y * 0.62 - 0.0016, abs(wq.y - wc.y) * 0.017 - 0.0034);
    if (abs(wq.x) < 1.6 && y < T.z - 0.008 && y > crag && sh < -0.0015) win = max(win, af(wbox, px) * lit);
  }
  // bridges and walls tying it together
  d = min(d, max(abs(y - crag - 0.022) - 0.006, max(-0.14 - x, x - 0.47)));
  float br = max(abs(y - 0.068) - 0.004, max(0.088 - x, x - 0.16));
  br = min(br, max(max(abs(y - 0.055) - 0.010, max(0.088 - x, x - 0.16)), -sdCircle(vec2(mod(x - 0.088, 0.024) - 0.012, y - 0.045), 0.009)));
  d = min(d, br);
  // the boathouse mouth glowing at the water line
  vec2 bh = vec2(x - 0.11, y - LM_HZ - 0.003);
  float mouth = max(abs(bh.x) - 0.016, max(-bh.y, bh.y - 0.012 - 0.008 * sqrt(max(0.0, 1.0 - bh.x * bh.x / 0.000256))));
  win = max(win, af(mouth, px) * 0.8 * step(d, 0.0));
  // a few lit windows cut into the rock face
  vec2 rq = vec2(x * 60.0, y * 55.0);
  vec2 rc = floor(rq);
  float rw = step(0.994, hash21(rc + 3.0)) * af(max(abs(fract(rq.x) - 0.5) - 0.14, abs(fract(rq.y) - 0.5) - 0.2) / 60.0, px);
  if (rock < -0.004 && y > LM_HZ + 0.02) win = max(win, rw * 0.7);
  return vec2(d, win);
}

/* a small boat with a lantern on a pole, passengers huddled; local units */
float lmBoat(vec2 q, float t, float seed, out float lantern){
  float hull = max(sdEllipse(q - vec2(0.0, 0.035), vec2(0.16, 0.05)), q.y - 0.025);
  hull = max(hull, -q.y - 0.02);
  float d = hull;
  for (int k = 0; k < 3; k++){
    float fk = float(k);
    vec2 c = vec2(-0.07 + fk * 0.06 + 0.01 * hash11(seed + fk), 0.045);
    float hh = 0.030 + 0.012 * hash11(seed * 3.0 + fk);
    d = min(d, sdBox(q - c - vec2(0.0, hh * 0.5), vec2(0.016, hh * 0.5)) - 0.006);
    d = min(d, sdCircle(q - c - vec2(0.002, hh + 0.016), 0.012));
    // pointed hats on some of them
    if (hash11(seed + fk * 9.0) > 0.5) d = min(d, sdTri(q, c + vec2(-0.016, hh + 0.022), c + vec2(0.018, hh + 0.022), c + vec2(0.006, hh + 0.060)));
  }
  // the pole and its lantern at the bow
  d = min(d, sdSeg(q, vec2(0.12, 0.02), vec2(0.15, 0.15)) - 0.0035);
  d = min(d, sdSeg(q, vec2(0.15, 0.15), vec2(0.185, 0.145)) - 0.003);
  vec2 lp = q - vec2(0.185, 0.118);
  lantern = sdBox(lp, vec2(0.009, 0.013));
  d = min(d, max(sdBox(lp, vec2(0.011, 0.015)), -lantern));
  return d;
}

vec3 lmSky(vec2 p, float px, float t){
  float h = p.y - LM_HZ;
  vec3 c = mix(vec3(0.16, 0.20, 0.26), vec3(0.040, 0.065, 0.11), smoothstep(0.0, 0.25, h));
  c = mix(c, vec3(0.008, 0.016, 0.040), smoothstep(0.20, 0.65, h));
  float dm = length(p - LM_MOON);
  // a moon smothered in drifting cloud
  c += vec3(0.55, 0.65, 0.80) * exp(-dm * 4.0) * 0.35 + vec3(0.8, 0.86, 0.95) * exp(-dm * 20.0) * 0.7;
  c = mix(c, vec3(0.95, 0.96, 1.0) * 1.6, af(dm - 0.032, px) * 0.85);
  vec2 cq = vec2(p.x * 1.6 - t * 0.008, p.y * 3.5);
  float cl = fbm4(cq + vec2(fbm3(cq * 1.3 + t * 0.005), 0.0));
  float lit = exp(-dm * 3.0);
  c = mix(c, mix(vec3(0.05, 0.07, 0.11), vec3(0.40, 0.46, 0.56), lit), smoothstep(0.42, 0.80, cl) * 0.85);
  c += starfield(p, 80.0, 0.965, t, px) * 0.6 * smoothstep(0.10, 0.35, h) * (1.0 - smoothstep(0.45, 0.75, cl)) * smoothstep(0.1, 0.5, dm);
  return c;
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 p0 = p + m * vec2(0.006, 0.004);
  vec2 p1 = p + m * vec2(0.014, 0.006);
  vec2 p2 = p + m * vec2(0.030, 0.012);

  vec3 col;
  float hz = LM_HZ;
  if (p1.y > hz){
    col = lmSky(p0, px, t);
    // far hills around the lake
    float hl = hz + 0.035 * fbm1lo(p1.x * 2.2 + 4.0) + 0.06 * (1.0 - smoothstep(-0.75, -0.25, p1.x)) + 0.05 * smoothstep(0.45, 0.85, p1.x);
    float hcov = af(p1.y - hl, px);
    col = mix(col, vec3(0.035, 0.050, 0.070) + vec3(0.05, 0.07, 0.09) * exp(-(p1.y - hz) * 30.0), hcov);
    // the castle on its crag
    if (p1.x > -0.30 && p1.x < 0.62 && p1.y < 0.34){
      vec2 cs = lmCastle(p1, px, t);
      float cov = af(cs.x, px);
      vec3 cc = vec3(0.022, 0.030, 0.045) + vec3(0.10, 0.12, 0.16) * exp(-(p1.y - hz) * 12.0) * 0.4;
      cc *= 0.8 + 0.4 * fbm4(p1 * vec2(40.0, 18.0));
      // moonlit edges on the left of each shape
      cc += vec3(0.25, 0.30, 0.40) * exp(-abs(cs.x) * 900.0) * 0.35;
      col = mix(col, cc, cov);
      float fl = 0.85 + 0.15 * sin(t * 3.0 + p1.x * 200.0 + p1.y * 100.0);
      col += vec3(1.0, 0.68, 0.30) * cs.y * 1.5 * fl;
      // the windows' glow hanging in the damp air
      col += vec3(1.0, 0.60, 0.25) * 0.06 * exp(-max(cs.x, 0.0) * 120.0) * smoothstep(-0.03, 0.10, p1.y);
    }
  } else {
    // the black lake, barely rippled, holding the castle's lights
    float dy = max(hz - p2.y, 0.0005);
    vec3 rd = normalize(vec3(p2.x, -dy, 1.3));
    float tt = 1.0 / -rd.y;
    vec2 W = vec2(rd.x, rd.z) * tt;
    float fp = tt * tt * px * 0.9 + 0.002;
    vec2 g = vec2(0.0);
    for (int i = 0; i < 6; i++){
      float fi = float(i);
      float kf = 2.0 * pow(1.6, fi);
      float an = 1.5708 + (hash11(fi * 5.1) - 0.5) * 2.0;
      vec2 kv = vec2(cos(an), sin(an)) * kf;
      float lod = 1.0 - smoothstep(0.35, 1.3, kf * fp);
      g += 0.018 / kf * kv * cos(dot(kv, W) + t * sqrt(kf) * 0.9 + fi) * lod;
    }
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
    // mirror: the sky and castle seen through the ripples
    vec2 qm = vec2(p2.x + n.x * 0.06, 2.0 * hz - p2.y + n.z * 0.20 * (0.25 + dy * 3.0));
    vec3 refl = lmSky(qm - m * vec2(0.016, 0.0), px * 6.0, t) * 0.65;
    float hl = hz + 0.035 * fbm1lo(qm.x * 2.2 + 4.0) + 0.06 * (1.0 - smoothstep(-0.75, -0.25, qm.x)) + 0.05 * smoothstep(0.45, 0.85, qm.x);
    refl = mix(refl, vec3(0.03, 0.045, 0.06), af(qm.y - hl, px * 3.0));
    if (qm.x > -0.30 && qm.x < 0.62 && qm.y < 0.34){
      vec2 cs = lmCastle(qm, px * 3.0, t);
      refl = mix(refl, vec3(0.02, 0.026, 0.038), af(cs.x, px * 3.0));
      refl += vec3(1.0, 0.62, 0.26) * cs.y * 0.9;
    }
    vec3 water = vec3(0.006, 0.012, 0.020);
    col = mix(water, refl, 0.35 + 0.65 * fres);
    col = mix(col, vec3(0.13, 0.16, 0.21), smoothstep(14.0, 70.0, tt) * 0.8);
  }

  // mist: a bank on the far water, wisps clinging to the crag
  float mb = exp(-abs(p1.y - hz - 0.025) * 16.0);
  float mn = fbm4(vec2(p1.x * 2.6 - t * 0.015, p1.y * 9.0 + t * 0.01));
  vec3 fogc = vec3(0.20, 0.25, 0.32) + vec3(0.30, 0.20, 0.10) * exp(-length((p1 - vec2(0.16, hz + 0.05)) * vec2(1.0, 2.5)) * 4.0) * 0.5;
  col = mix(col, fogc, mb * smoothstep(0.30, 0.78, mn) * 0.85);
  float mw = exp(-abs(p1.y - 0.02) * 9.0) * smoothstep(-0.30, 0.0, p1.x) * (1.0 - smoothstep(0.45, 0.70, p1.x));
  col = mix(col, fogc * 0.9, mw * smoothstep(0.50, 0.85, fbm4(vec2(p1.x * 4.0 + t * 0.02, p1.y * 14.0))) * 0.45);
  col = mix(col, vec3(0.10, 0.13, 0.18), 0.12 * smoothstep(-0.2, 0.3, p1.y));

  // a procession of lantern boats drifting toward the boathouse
  for (int b = 0; b < 5; b++){
    float fb = float(b);
    float ph = fract(fb / 5.0 + t * 0.006);          // 0 near the viewer, 1 at the castle
    float z = mix(0.30, 4.2, ph * ph);
    float sc = 0.42 / z;
    float yb = hz - 0.095 / z;
    float xb = mix(-0.70, 0.11, pow(ph, 0.7)) + 0.03 * sin(fb * 2.3) * (1.0 - ph);
    float fade = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.88, 1.0, ph));
    vec2 bq = (p2 - vec2(xb, yb)) / (sc * 0.55);
    float bob = 0.006 * sin(t * 1.3 + fb * 2.0);
    bq.y -= bob;
    bq = rot2(0.03 * sin(t * 0.9 + fb)) * bq;
    float pxb = px / (sc * 0.55);
    float lantD;
    if (abs(bq.x) < 0.30 && bq.y > -0.05 && bq.y < 0.26){
      float d = lmBoat(bq, t, fb * 13.0, lantD);
      vec3 bc = vec3(0.012, 0.016, 0.022) + vec3(1.0, 0.6, 0.25) * exp(-length(bq - vec2(0.185, 0.118)) * 14.0) * 0.5;
      col = mix(col, bc, af(d, pxb) * fade);
      col += vec3(1.0, 0.75, 0.40) * af(lantD, pxb) * 2.0 * fade;
    }
    vec2 lw = vec2(xb, yb) + vec2(0.185, 0.118 + bob) * sc * 0.55;
    float ld = length(p2 - lw);
    float fl = 0.85 + 0.15 * sin(t * 6.0 + fb * 3.0) * sin(t * 2.3 + fb);
    col += vec3(1.0, 0.62, 0.26) * (exp(-ld * 650.0 / sc) * 1.4 + exp(-ld * 40.0 / sc) * 0.12) * fl * fade;
    // its light trembling on the water below
    if (p2.y < yb){
      float dxl = p2.x - lw.x + 0.004 * sin(p2.y * 300.0 / sc + t * 3.0);
      float rr = (yb - p2.y) / (0.10 * sc);
      col += vec3(1.0, 0.58, 0.24) * exp(-dxl * dxl * 5000.0 / (sc * sc)) * exp(-rr * rr) * (0.5 + 0.5 * sin(p2.y * 900.0 / sc - t * 4.0)) * 0.6 * fl * fade;
    }
  }

  // low fog drifting over the near water
  float fg = smoothstep(0.45, 0.85, fbm4(vec2(p2.x * 1.8 + t * 0.03, p2.y * 5.0 - t * 0.01))) * smoothstep(-0.12, -0.50, p2.y);
  col = mix(col, vec3(0.16, 0.20, 0.26), fg * 0.35);

  col = filmic(col * 1.25);
  col = grade(col, vec3(0.88, 0.98, 1.14), vec3(1.08, 1.0, 0.90), 0.6);
  return col;
}`;
