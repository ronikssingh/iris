/* Windsweep: a sea of tall grass bowing under a hard wind at golden hour, one red maple on a knoll,
   gusts running across the plain in long silver swaths, leaves and seed-down streaming past. */

export const windsweep = /* glsl */ `
const vec2 WS_VP = vec2(0.0, 0.030);       // horizon
const vec2 WS_SUN = vec2(-0.50, 0.128);
const float WS_EYE = 2.4;                  // we stand on a slight rise
const vec3 WS_TREE = vec3(34.0, 0.0, 92.0); // the maple's knoll (x, -, depth)

/* gusts: a wind field on the ground rolling across the plain from left to right */
float wsGust(float X, float Z, float t){
  vec2 q = vec2(X * 0.030 - t * 0.55, Z * 0.055);
  float w = fbm3(q * 0.8 + vec2(t * 0.03, 0.0));
  return smoothstep(0.30, 0.74, fbm4(q + vec2(w * 0.9, w * 0.3)));
}
vec3 wsHaze(vec2 p){
  return mix(vec3(1.0, 0.74, 0.48), vec3(0.70, 0.70, 0.74), smoothstep(-0.6, 0.8, p.x))
       + vec3(0.30, 0.16, 0.05) * exp(-length((p - WS_SUN) * vec2(0.7, 1.8)) * 2.4);
}
/* the rolling ground: height in metres at (x, depth), with the knoll the maple stands on */
float wsGround(float X, float Z){
  float h = 3.2 * (vnoise(vec2(X * 0.010, Z * 0.012) + 3.0) - 0.5) + 1.1 * (vnoise(vec2(X * 0.04, Z * 0.05)) - 0.5);
  vec2 kd = vec2(X - WS_TREE.x, (Z - WS_TREE.z) * 0.55);
  return h + 6.5 * exp(-dot(kd, kd) / 220.0);
}

vec3 wsSky(vec2 p, float t, out float cloud){
  float h = p.y - WS_VP.y;
  vec3 c = mix(vec3(1.0, 0.60, 0.30), vec3(0.98, 0.66, 0.50), smoothstep(0.0, 0.12, h));
  c = mix(c, vec3(0.60, 0.62, 0.82), smoothstep(0.10, 0.36, h));
  c = mix(c, vec3(0.26, 0.40, 0.68), smoothstep(0.28, 0.56, h));
  float ds = length((p - WS_SUN) * vec2(1.0, 1.15));
  c += vec3(1.0, 0.56, 0.24) * exp(-ds * 2.4) * 0.55 + vec3(1.0, 0.82, 0.52) * exp(-ds * 9.0) * 0.75;
  // towering cumulus: billowed, flat-bottomed, lit gold from the low sun, lavender in their own shade
  vec2 cq = vec2(p.x * 1.15 - t * 0.0045, (p.y - 0.06) * 2.1);
  float env = vnoise(cq * vec2(0.9, 0.7) + 7.0) * 0.6 + vnoise(cq * 1.9 + 3.0) * 0.4;
  float tb = 0.0, amp = 0.5; vec2 q = cq * 2.2;
  for (int i = 0; i < 4; i++){ tb += amp * abs(gnoise(q)); q = FBM_M * q; amp *= 0.5; }
  float base = smoothstep(0.08, 0.15, h);
  float D = env * 1.05 + tb * 0.55 - 0.74 + 0.10 * smoothstep(0.15, 0.45, h);
  float dens = smoothstep(0.0, 0.05, D) * base * smoothstep(0.75, 0.50, h);
  cloud = dens;
  if (dens > 0.0){
    vec2 o = normalize(WS_SUN - p) * 0.05;
    vec2 cq2 = cq + vec2(o.x * 1.15, o.y * 2.1);
    float env2 = vnoise(cq2 * vec2(0.9, 0.7) + 7.0) * 0.6 + vnoise(cq2 * 1.9 + 3.0) * 0.4;
    float lit = clamp((env - env2) * 6.0 + (tb - 0.25) * 1.2 + 0.40, 0.0, 1.0);
    vec3 cc = mix(vec3(0.52, 0.42, 0.56), vec3(1.0, 0.84, 0.62), smoothstep(0.1, 0.9, lit));
    cc = mix(cc, vec3(0.52, 0.44, 0.56), smoothstep(0.16, 0.08, h) * 0.6);
    float rim = smoothstep(0.0, 0.03, D) * smoothstep(0.10, 0.03, D);
    cc += vec3(1.0, 0.82, 0.55) * rim * (0.20 + 1.0 * exp(-ds * 2.4));
    c = mix(c, cc, dens);
  }
  c += vec3(1.0, 0.90, 0.70) * smoothstep(0.030, 0.022, ds) * (1.0 - dens * 0.85) * 2.2;
  return c;
}

/* the maple: tree-local coords, unit height. returns (wood distance, foliage density, clump light) */
vec3 wsMaple(vec2 q, float sway){
  float d = sdTaper(q, vec2(0.0, -0.06), vec2(0.02, 0.20), 0.065, 0.045);
  d = min(d, sdTaper(q, vec2(0.02, 0.18), vec2(0.04, 0.36), 0.045, 0.030));
  d = min(d, sdTaper(q, vec2(0.03, 0.28), vec2(-0.24, 0.55), 0.030, 0.010));
  d = min(d, sdTaper(q, vec2(0.04, 0.33), vec2(-0.05, 0.72), 0.026, 0.008));
  d = min(d, sdTaper(q, vec2(0.04, 0.34), vec2(0.22, 0.66), 0.026, 0.008));
  d = min(d, sdTaper(q, vec2(0.03, 0.25), vec2(0.36, 0.46), 0.024, 0.007));
  d = min(d, sdTaper(q, vec2(0.02, 0.21), vec2(-0.33, 0.37), 0.020, 0.006));
  d = min(d, sdTaper(q, vec2(-0.13, 0.44), vec2(-0.22, 0.63), 0.010, 0.003));
  d = min(d, sdTaper(q, vec2(0.14, 0.52), vec2(0.29, 0.62), 0.010, 0.003));
  d = min(d, sdTaper(q, vec2(-0.20, 0.33), vec2(-0.38, 0.47), 0.008, 0.003));
  vec2 c = q - vec2(sway * q.y * q.y, 0.0);
  float D = 1.0 - length((c - vec2(0.02, 0.62)) / vec2(0.44, 0.24));
  D = max(D, 1.0 - length((c - vec2(-0.27, 0.50)) / vec2(0.21, 0.15)));
  D = max(D, 1.0 - length((c - vec2(0.31, 0.51)) / vec2(0.20, 0.15)));
  D = max(D, 1.0 - length((c - vec2(-0.02, 0.80)) / vec2(0.25, 0.14)));
  D = max(D, 1.0 - length((c - vec2(0.18, 0.74)) / vec2(0.17, 0.12)));
  D += 0.16 * (vnoise(c * 7.0) - 0.5);
  float F = -1.0, L = 0.0;
  if (D > -0.25){
    vec3 C = clump2(c * 13.0, 3.0);
    F = min(C.x - 0.40 + 2.4 * D, D + 0.10);
    if (F > -0.22) F += 0.22 * (clump2(c * 36.0, 7.0).x - 0.08) * smoothstep(-0.22, 0.04, F) * smoothstep(-0.12, 0.05, D);
    L = -C.y * 0.7 - C.z * 0.3;
  }
  return vec3(d, F, L);
}

/* one row of grass at depth z: the mass of blades and the plumes above it, in metres.
   returns colour (hazed) and coverage */
vec4 wsRow(vec2 p, float z, float r, float g, float t, float px, vec3 hz){
  float X = (p.x - WS_VP.x) * z;
  float pw = px * z;
  float Yf = (p.y - WS_VP.y) * z + WS_EYE;            // height above a flat ground
  vec2 kd = vec2(X - WS_TREE.x, (z - WS_TREE.z) * 0.55);
  float knoll = 6.5 * exp(-dot(kd, kd) / 220.0);
  if (Yf - knoll - 2.4 > 2.0 || Yf + 2.4 < -pw) return vec4(0.0);
  float hg = wsGround(X, z);
  float Y = Yf - hg;
  // on the knoll's rising face, each row's grass reaches down to meet the row in front
  float reach = 0.05;
  if (knoll > 0.15){
    float zPrev = z < 23.5 ? z / 1.19 : z / 1.30;
    reach += max(hg - wsGround((p.x - WS_VP.x) * zPrev, zPrev), 0.0) * 1.1;
  }
  if (Y > 2.0 || Y < -reach - pw) return vec4(0.0);
  float hm = 0.66 + 0.30 * n1(X * 1.3 + r * 3.1) + 0.12 * n1(X * 5.0 + r * 1.7) + 0.12 * g;
  // the top of the mass: blade tips, fine up close, a ragged edge further off
  float tipD;
  if (z < 26.0){
    float cwb = 0.05;
    float lean = 0.25 + 0.45 * g;
    float xb = X - lean * max(Y - hm, 0.0);
    float cb = floor(xb / cwb);
    tipD = 1e5;
    for (int j = -1; j <= 1; j++){
      float id = cb + float(j);
      float hh = hash11(id * 2.31 + r * 5.0);
      float bx = (id + 0.5) * cwb + (hh - 0.5) * cwb * 0.6;
      float th = hm + 0.05 + 0.26 * hh * hh;
      float f = clamp((Y - hm + 0.12) / (th - hm + 0.12), 0.0, 1.0);
      float w = 0.014 * (1.0 - f);
      tipD = min(tipD, max(abs(xb - bx) - w, Y - th));
    }
    tipD = min(tipD, Y - hm + 0.05);
  } else {
    tipD = Y - hm - (0.12 * pow(n1(X * 21.0 + r * 7.7), 3.0) + 0.06 * pow(n1(X * 47.0 + r), 2.0)) * smoothstep(80.0, 30.0, z);
  }
  float dM = max(tipD, -Y - reach);
  // plumes: stems bowed downwind, silky heads of fine strands streaming off their tips
  float dS = 1e5, hc = 0.0, hf = 0.0, hu = 0.0;
  if (Y > hm - 0.2 && z < 55.0){
    float B = 0.20 + 0.60 * g + 0.05 * sin(t * 2.1 + X * 0.3);
    float cw = 0.20 * (z > 50.0 ? 1.5 : 1.0);
    float yy0 = clamp(Y / 1.45, 0.0, 1.0);
    float xs = X - B * 1.45 * yy0 * yy0;
    float ci = floor(xs / cw);
    for (int j = -1; j <= 1; j++){
      float id = ci + float(j);
      float h1 = hash11(id * 1.37 + r * 17.0);
      if (h1 < 0.20 + 0.45 * n1(X * 0.12 + r * 1.7)) continue;
      float x0 = (id + 0.15 + 0.70 * hash11(id * 3.1 + r)) * cw;
      float H = 1.05 + 0.50 * hash11(id * 5.7 + r * 3.0);
      float bw = B * (0.85 + 0.30 * h1) + 0.05 * sin(t * 3.1 + id * 1.9);
      float yy = Y / H;
      if (yy < 0.40 || yy > 1.08) continue;
      // the stem
      float sx = x0 + bw * H * yy * yy;
      float stem = abs(X - sx) - 0.0035;
      if (yy < 0.70 && stem < dS){ dS = stem; }
      // the head: from 70% of the stem it runs on along the bowed line; a fan of strands with a hairy fringe
      vec2 s0 = vec2(x0 + bw * H * 0.49, 0.70 * H);
      vec2 dir = normalize(vec2(2.0 * bw * 0.70 + 0.25 * g, 1.0));
      vec2 nrm = vec2(dir.y, -dir.x);
      float LH = H * (0.30 + 0.06 * h1);
      vec2 dq = vec2(X, Y) - s0;
      float u = dot(dq, dir) / LH;
      if (u < -0.05 || u > 1.05) continue;
      float v = dot(dq, nrm) / LH;
      v -= 0.10 * u * u * (0.5 + g);                     // the tip droops downwind
      float spread = 0.050 * pow(max(u, 0.0), 0.8) * (1.0 + 0.6 * g);
      float vj = v + spread * 0.35 * sin(u * 11.0 + id * 2.3);
      float k = clamp(floor(vj / max(spread, 1e-3) + 0.5), -3.0, 3.0);
      float dv = abs(vj - k * spread) * LH;
      float core = dv - 0.0030 * (1.0 - 0.7 * u);
      float fringe = exp(-dv / (0.012 + 0.014 * u)) * smoothstep(1.05, 0.70, u) * smoothstep(-0.05, 0.15, u);
      float inside = smoothstep(3.6 * spread * LH + 0.014, 0.0, abs(v) * LH);
      float cov = max(af(core, max(pw, 0.002)) * 0.9, fringe * 0.62) * max(inside, 0.20);
      if (cov > hc){ hc = cov; hu = u; }
    }
  }
  float cM = af(dM, pw * (1.0 + smoothstep(30.0, 120.0, z) * 1.5));
  float cS = af(dS, pw) * clamp(0.007 / pw, 0.15, 1.0) * 0.8;
  float cH = clamp(hc, 0.0, 1.0) * (z < 60.0 ? 1.0 : 0.7);
  if (max(cM, max(cS, cH)) <= 0.0) return vec4(0.0);
  // the mass stands in its own shade (the sun is behind it); gusts lay it over to show a pale sheen; tips glow
  vec3 mass = mix(vec3(0.12, 0.085, 0.038), vec3(0.66, 0.52, 0.26), g * g * 0.9);
  float bl = n1((X + (hm - Y) * 0.4 * (0.4 + g)) * 18.0 + r * 11.0);
  mass *= (0.72 + 0.40 * bl * step(z, 40.0) + 0.14 * step(40.0, z)) * mix(0.82 + 0.18 * smoothstep(-0.2, hm, max(Y, 0.0)), 0.92, smoothstep(30.0, 70.0, z));
  mass += vec3(1.0, 0.66, 0.30) * smoothstep(hm, hm + 0.25, Y) * (0.16 + 0.22 * g) * smoothstep(120.0, 25.0, z);
  float sunward = 0.60 + 0.55 * exp(-abs(p.x - WS_SUN.x) * 1.3);
  vec3 stemC = vec3(0.40, 0.30, 0.14) * (0.8 + 0.4 * g);
  vec3 headC = mix(vec3(0.82, 0.70, 0.52), vec3(1.0, 0.84, 0.56), 0.5 + 0.5 * g) * sunward * (0.85 + 0.25 * hu);
  headC = mix(headC, vec3(0.95, 0.62, 0.50) * sunward, 0.35 * smoothstep(0.55, 0.8, n1(X * 0.4 + r * 5.3)));
  vec3 rc = mass * cM; float ra = cM;
  rc = stemC * cS + rc * (1.0 - cS); ra = cS + ra * (1.0 - cS);
  rc = headC * cH + rc * (1.0 - cH); ra = cH + ra * (1.0 - cH);
  vec3 c = mix(rc / max(ra, 1e-4), hz, 1.0 - exp(-z * 0.0034));
  return vec4(c, ra);
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 p0 = p + m * vec2(0.004, 0.003);

  float cloud;
  vec3 col = wsSky(p0, t, cloud);
  vec3 hz = wsHaze(p0);

  // the far range: eroded faces lit from the low sun on the left, snow lying on the ledges
  {
    float r1 = ridge1(p0.x * 2.0 + 3.0);
    float m1 = WS_VP.y + 0.045 + 0.095 * r1 - 0.030 * smoothstep(-0.3, 0.8, p0.x);
    if (p0.y < m1 + px * 2.0){
      vec2 mq = vec2(p0.x * 9.0, p0.y * 13.0);
      float e = 0.02;
      float h0 = ridge(mq), hx = ridge(mq + vec2(e, 0.0)), hy = ridge(mq + vec2(0.0, e));
      vec3 n = normalize(vec3(-(hx - h0) / e, -(hy - h0) / e, 1.6));
      float litF = clamp(dot(n, normalize(vec3(-0.75, 0.35, 0.55))) * 1.2, 0.0, 1.0);
      float below = m1 - p0.y;
      vec3 mc = mix(vec3(0.42, 0.42, 0.58), vec3(1.0, 0.76, 0.58), litF);
      float snow = smoothstep(0.35, 0.75, n.y * 0.9 + h0 * 0.6 - below * 9.0);
      mc = mix(mc, mix(vec3(0.70, 0.72, 0.88), vec3(1.0, 0.90, 0.78), litF), snow * 0.85);
      mc = mix(mc, hz, 0.30 + 0.50 * smoothstep(0.02, 0.10, below));
      col = mix(col, mc, af(p0.y - m1, px));
    }
  }
  // nearer foothills, soft and blue in the haze
  vec2 p1 = p + m * vec2(0.008, 0.004);
  {
    float m2 = WS_VP.y + 0.012 + 0.030 * fbm1lo(p1.x * 2.6 + 11.0) + 0.018 * smoothstep(0.2, 0.9, p1.x);
    if (p1.y < m2 + px * 2.0){
      float e = 0.004;
      float sl = (fbm1lo((p1.x + e) * 2.6 + 11.0) - fbm1lo((p1.x - e) * 2.6 + 11.0)) / (2.0 * e) * 0.030;
      vec3 mc = mix(vec3(0.36, 0.38, 0.48), vec3(0.88, 0.66, 0.50), clamp(0.45 + sl * 4.0, 0.0, 1.0) * 0.6);
      mc = mix(mc, hz, 0.45 + 0.35 * smoothstep(0.0, 0.03, m2 - p1.y));
      col = mix(col, mc, af(p1.y - m2, px));
    }
  }
  // a line of trees along the far edge of the plain
  vec2 p2 = p + m * vec2(0.010, 0.005);
  {
    float ytl = WS_VP.y + 0.003 + 0.010 * fbm1lo(p2.x * 6.0 + 2.0) * smoothstep(0.9, 0.1, abs(p2.x + 0.1));
    float D = (ytl - p2.y) / 0.009;
    if (D > -0.3){
      vec3 C = clump2(p2 * vec2(160.0, 180.0), 1.0);
      float F = min(C.x - 0.42 + 2.2 * D, D + 0.14);
      vec3 tc = mix(vec3(0.18, 0.20, 0.17), hz, 0.55);
      col = mix(col, tc, af(-F * 0.004, px));
    }
  }

  // the plain, row upon row of grass from our feet to the haze, front to back; the maple stands among them
  vec2 pf = p + m * vec2(0.020, 0.006);
  float zp = pf.y < WS_VP.y - 0.002 ? clamp(WS_EYE / (WS_VP.y - pf.y), 3.0, 160.0) : WS_TREE.z;
  float g = wsGust(pf.x * zp, zp, t);
  vec3 hzf = wsHaze(pf);
  vec3 acc = vec3(0.0); float T = 1.0;
  bool treeDone = false;
  float sway = 0.025 + 0.045 * wsGust(WS_TREE.x, WS_TREE.z, t - 0.2) + 0.008 * sin(t * 1.9);
  for (int r = 0; r < 21; r++){
    float z = r < 11 ? 3.4 * pow(1.19, float(r)) : 22.9 * pow(1.30, float(r - 11));
    if (!treeDone && z > WS_TREE.z){
      treeDone = true;
      vec2 tb = WS_VP + vec2(WS_TREE.x, wsGround(WS_TREE.x, WS_TREE.z) + 0.6 - WS_EYE) / WS_TREE.z;
      float S = 17.0 / WS_TREE.z;
      vec2 q = (pf - tb) / S;
      if (abs(q.x) < 0.75 && q.y > -0.1 && q.y < 1.05){
        vec3 tr = wsMaple(q, sway);
        float pxq = px / S;
        float cw = af(tr.x, pxq);
        float cf = af(-tr.y * 0.04, pxq);
        vec3 wood = vec3(0.06, 0.035, 0.03) + vec3(1.0, 0.60, 0.30) * smoothstep(0.0, -0.05, q.x - 0.025 * q.y) * 0.16;
        float edgeF = smoothstep(0.10, 0.0, tr.y);
        vec3 lf = mix(vec3(0.30, 0.035, 0.025), vec3(0.72, 0.13, 0.04), 0.5 + 0.5 * vnoise(q * 9.0));
        lf *= 0.84 + 0.22 * smoothstep(-0.6, 0.8, tr.z);
        lf += vec3(1.0, 0.52, 0.14) * edgeF * smoothstep(-0.2, 0.8, tr.z) * 0.85;
        lf += vec3(1.0, 0.74, 0.34) * edgeF * smoothstep(0.25, -0.45, q.x) * 0.55;
        vec3 tcol = mix(wood, lf, cf);
        float ta = max(cw, cf);
        tcol = mix(tcol, hzf, 0.18);
        acc += T * tcol * ta; T *= 1.0 - ta;
      }
    }
    if (T < 0.01) break;
    vec4 s = wsRow(pf, z, float(r), g, t, px, hzf);
    if (s.a > 0.0){ acc += T * s.rgb * s.a; T *= 1.0 - s.a; }
  }
  // beyond the last row the plain is a smooth haze-gold carpet
  if (T > 0.0 && pf.y < WS_VP.y + 0.012){
    vec3 carpet = mix(vec3(0.42, 0.31, 0.14), vec3(0.80, 0.62, 0.34), g);
    carpet = mix(carpet, hzf, mix(0.25, 0.65, smoothstep(WS_VP.y - 0.06, WS_VP.y, pf.y)));
    float cov = smoothstep(WS_VP.y + 0.010, WS_VP.y + 0.002, pf.y);
    col = mix(col, carpet, cov);
  }
  col = acc + T * col;

  // light through the air: long rays from the sun, broken by the clouds
  vec2 sd = p0 - WS_SUN;
  float ang = atan(sd.y, sd.x);
  float rays = smoothstep(0.50, 0.95, n1(ang * 9.0 + 2.0 + t * 0.02)) * 0.6 + smoothstep(0.55, 1.0, n1(ang * 21.0 - t * 0.03)) * 0.4;
  rays *= exp(-length(sd) * 1.6) * (1.0 - cloud * 0.8);
  col += vec3(1.0, 0.76, 0.46) * rays * 0.16;
  col += vec3(1.0, 0.66, 0.34) * exp(-length(sd * vec2(0.6, 1.2)) * 2.5) * 0.10;

  // leaves torn from the maple, tumbling away downwind
  vec2 tb0 = WS_VP + vec2(WS_TREE.x, wsGround(WS_TREE.x, WS_TREE.z) + 0.6 - WS_EYE) / WS_TREE.z;
  bool leafZone = p.x > tb0.x - 0.14 && p.y > tb0.y - 0.16 && p.y < tb0.y + 0.30;
  for (int i = 0; i < 22; i++){
    if (!leafZone) break;
    float fi = float(i);
    float life = 7.0 + 4.0 * hash11(fi * 2.3);
    float age = mod(t + hash11(fi * 7.7) * life, life);
    vec2 s0 = tb0 + vec2((hash11(fi * 3.1) - 0.35) * 0.16, 0.08 + 0.09 * hash11(fi * 5.3));
    vec2 lp = s0 + vec2((0.05 + 0.05 * hash11(fi * 9.1)) * age + 0.02 * sin(age * 1.7 + fi), -0.015 * age + 0.018 * sin(age * 2.3 + fi * 2.0));
    lp += m * vec2(0.025, 0.008);
    vec2 lq = p - lp;
    if (dot(lq, lq) > 0.0004) continue;
    float spin = age * (3.0 + 3.0 * hash11(fi)) + fi;
    lq = rot2(spin) * lq;
    lq.x /= 0.25 + 0.75 * abs(cos(spin * 0.7));
    float sz = 0.0040 + 0.0025 * min(age * 0.15, 1.0);
    float ld = length(lq / vec2(sz * 1.3, sz)) - 1.0;
    float fade = smoothstep(0.0, 0.6, age) * smoothstep(life, life - 1.5, age);
    vec3 lc = mix(vec3(0.78, 0.14, 0.04), vec3(1.0, 0.55, 0.12), hash11(fi * 4.4)) * (0.8 + 0.5 * abs(cos(spin)));
    col = mix(col, lc, clamp(-ld * 3.0, 0.0, 1.0) * fade);
  }
  // seed-down drifting in the gold light
  for (int i = 0; i < 16; i++){
    float fi = float(i);
    float sp = 0.035 + 0.04 * hash11(fi * 1.9);
    float x = mod(hash11(fi * 3.3) * 2.0 + t * sp, 2.0) - 1.0;
    float y = -0.40 + 0.75 * hash11(fi * 5.1) + 0.03 * sin(t * (0.6 + hash11(fi)) + fi * 3.0);
    vec2 sp2 = vec2(x * asp * 0.6, y) + m * vec2(0.02 + 0.03 * hash11(fi), 0.01);
    float d = length(p - sp2);
    if (d > 0.02) continue;
    float rr = (0.0012 + 0.0016 * hash11(fi * 7.0)) * (0.8 + 0.4 * sin(t * 3.0 + fi));
    float fwd = 0.5 + 0.9 * exp(-length(sp2 - WS_SUN) * 1.5);
    col += vec3(1.0, 0.92, 0.75) * exp(-d * d / (rr * rr)) * 0.55 * fwd;
  }
  // a skein of birds riding the wind high on the right
  {
    vec2 fc = vec2(mod(t * 0.018 + 0.3, 2.2) - 1.1, 0.32 + 0.015 * sin(t * 0.2));
    for (int i = 0; i < 7; i++){
      float fi = float(i);
      float row = floor((fi + 1.0) / 2.0);
      float side = mod(fi, 2.0) * 2.0 - 1.0;
      vec2 bp = fc + vec2(-row * 0.022, side * row * 0.012);
      vec2 bq = (p0 - bp) / 0.009;
      if (dot(bq, bq) > 4.0) continue;
      float fl = sin(t * 7.0 + fi * 1.3) * 0.5;
      float wing = min(sdSeg(bq, vec2(0.0), vec2(-0.9, 0.35 + fl)), sdSeg(bq, vec2(0.0), vec2(0.9, 0.35 + fl))) - 0.11;
      col = mix(col, vec3(0.22, 0.18, 0.20), af(wing * 0.009, px) * 0.85);
    }
  }

  col = filmic(col * 0.94);
  col = saturate3(col, 1.12);
  col = grade(col, vec3(0.90, 0.95, 1.10), vec3(1.08, 1.0, 0.86), 0.55);
  return col;
}`;
