/* Spirit Grove: an ancient cedar forest by night. A sacred tree girdled with rope and paper streamers,
   a stream winding through moss and stone, a stone lantern burning, a red gate deep in the mist, moonlight
   slanting through the canopy, spirit lights drifting, and a white stag with antlers of light in the water. */

export const spiritgrove = /* glsl */ `
const float SG_HZ = 0.035;
const float SG_E = 1.6;
const vec2 SG_MOON = vec2(0.10, 0.37);      // the moon, glimpsed through a gap in the canopy
const vec3 SG_MOONC = vec3(0.62, 0.78, 0.95);
const vec3 SG_SPIRIT = vec3(0.70, 1.0, 0.95);
const float SG_HC = 19.0;                    // the underside of the canopy, metres above the ground

float sgStreamX(float z){ return -0.6 + 1.6 * sin(z * 0.16 + 0.4) + 0.5 * sin(z * 0.41 + 2.0); }
vec3 sgMist(vec2 p){
  vec3 c = mix(vec3(0.060, 0.120, 0.135), vec3(0.015, 0.030, 0.045), smoothstep(SG_HZ - 0.05, 0.40, p.y));
  c += SG_MOONC * 0.07 * exp(-length((p - vec2(0.14, 0.06)) * vec2(0.8, 2.2)) * 2.2);     // moonlit mist low over the stream
  return c + SG_MOONC * 0.16 * exp(-length(p - SG_MOON) * 4.5);                           // glowing around the moon
}

/* mist thins with height: night fog lies along the ground */
float sgMistF(float z, float h){ return 1.0 - exp(-z * 0.055 * mix(1.0, 0.40, smoothstep(2.5, 11.0, h))); }

/* the night sky through the gap in the canopy: the moon, its halo, stars */
vec3 sgSky(vec2 p, float t, float px){
  float dm = length(p - SG_MOON);
  vec3 c = mix(vec3(0.040, 0.075, 0.125), vec3(0.016, 0.030, 0.068), smoothstep(0.2, 0.6, p.y));
  c += SG_MOONC * (0.65 * exp(-dm * 12.0) + 0.22 * exp(-dm * 3.5));
  c += starfield(p, 150.0, 0.92, t, px) * 0.9 * smoothstep(0.04, 0.12, dm);
  float disc = af(dm - 0.030, px);
  vec2 mq = (p - SG_MOON) / 0.030;
  vec3 mc = vec3(0.90, 0.95, 1.0) * (0.86 + 0.14 * vnoise(mq * 3.0 + 4.0)) * (0.92 + 0.08 * sqrt(max(1.0 - dot(mq, mq), 0.0)));
  return mix(c, mc * 1.7, disc);
}

/* the canopy seen from beneath: a ceiling of crowns at SG_HC fading into mist, open around the moon */
vec3 sgCanopy(vec2 p, float t, float px){
  float zc = (SG_HC - SG_E) / max(p.y - SG_HZ, 1e-3);
  float mistF = max(1.0 - exp(-zc * 0.020), smoothstep(110.0, 160.0, zc));
  // the gap: an opening among the crowns, its edge feathered with boughs
  vec2 gq = (p - SG_MOON - vec2(0.02, 0.01)) * vec2(0.85, 1.25);
  float ga = atan(gq.y, gq.x);
  float gap = length(gq) - 0.115 - 0.030 * (n1(ga * 3.2 + 1.0) - 0.5) - 0.018 * (n1(ga * 9.0 + 4.0) - 0.5);
  gap += 0.010 * (clump2(p * 70.0, 3.0).x - 0.3);
  if (zc > 160.0 && gap > 0.05) return sgMist(p);
  float X = p.x * zc;
  float fw = px * zc * max(1.0, zc / (SG_HC - SG_E));
  vec2 w = vec2(X, zc);
  float lod = smoothstep(0.25, 0.9, fw);
  vec3 C = clump2(w * vec2(0.6, 0.45), 7.0);
  vec3 fol = vec3(0.006, 0.012, 0.012) * (0.7 + 0.6 * fbm4(w * 0.3));
  fol += SG_MOONC * smoothstep(0.2, 0.9, C.z * 0.6 - C.y * 0.3) * (1.0 - lod) * 0.020;
  float near = exp(-max(gap, 0.0) / 0.035);
  fol += SG_MOONC * near * 0.10;                                           // crowns lit around the opening
  vec3 c = mix(sgSky(p, t, px), fol, af(-gap, px * 1.5));
  c += SG_MOONC * exp(-max(gap, 0.0) / 0.010) * 0.10 * step(0.0, gap);    // needles silvered at its edge
  return mix(c, sgMist(p), mistF * mix(0.55, 1.0, smoothstep(-0.02, 0.06, gap)));
}

/* a distance to a segment, and how far along it */
vec2 sgSegH(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return vec2(length(pa - ba * h), h);
}
/* one frond of a cedar bough: a curved rachis O-M-E, pinnules alternating along it, swept toward its tip */
float sgFrond(vec2 q, vec2 O, vec2 M, vec2 E, float seed){
  vec2 s1 = sgSegH(q, O, M), s2 = sgSegH(q, M, E);
  float l1 = length(M - O), lt = l1 + length(E - M);
  vec2 A = O, B = M; float s0 = 0.0;
  if (s2.x < s1.x){ A = M; B = E; s0 = l1; }
  vec2 ax = normalize(B - A);
  vec2 rel = q - A;
  float sa = s0 + dot(rel, ax);
  float c = ax.x * rel.y - ax.y * rel.x;
  float d = min(s1.x, s2.x) - 0.0030 * (1.0 - 0.6 * clamp(sa / lt, 0.0, 1.0));
  float sg = c < 0.0 ? -1.0 : 1.0;
  float ds = lt / 16.0;
  float off = sg > 0.0 ? 0.20 * ds : 0.70 * ds;
  float n = floor((sa - off) / ds);
  for (int j = -1; j <= 0; j++){
    float sn = (n + float(j)) * ds + off;
    if (sn < 0.04 * lt || sn > 0.96 * lt) continue;
    float hn = sn / lt;
    float lp = lt * 0.23 * pow(1.0 - hn, 0.6) * (0.85 + 0.30 * hash11(sn * 91.0 + seed));
    vec2 P0 = vec2(sn, 0.0);
    vec2 P1 = P0 + vec2(0.62, 0.78 * sg) * lp;
    d = min(d, sdTaper(vec2(sa, c), P0, P1, 0.0026, 0.0011));
  }
  return d;
}
/* a cedar bough close overhead, entering at a, heading right at angle ang, L long (screen units):
   a woody limb drooping toward its tip, fronds alternating along it, swept forward and hanging */
float sgBough(vec2 p, vec2 a, float ang, float L, float seed, float t){
  float sw = 0.020 * sin(t * 0.45 + seed * 3.0) + 0.008 * sin(t * 1.15 + seed);
  vec2 q = rot2(-(ang + sw)) * (p - a);
  if (q.x < -0.03 || q.x > L * 1.25 || q.y > 0.32 * L || q.y < -0.80 * L) return 1e5;
  float droop = 0.20;
  float ay = -droop * q.x * q.x / L;
  float d = abs(q.y - ay) * 0.95 - mix(0.0065, 0.0018, clamp(q.x / L, 0.0, 1.0));
  d = max(d, q.x - L);
  const float N = 12.0;
  float dl = L / N;
  float i0 = floor(q.x / dl - 0.5);
  for (int j = -2; j <= 1; j++){
    float fi = i0 + float(j);
    if (fi < 0.0 || fi >= N) continue;
    float xi = (fi + 0.5) * dl;
    float sg = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    float hh = hash11(fi * 3.7 + seed * 11.0);
    float l = L * 0.34 * (1.0 - 0.50 * xi / L) * (0.80 + 0.40 * hh);
    vec2 O = vec2(xi, -droop * xi * xi / L);
    float th = 0.62 + 0.25 * hh;
    vec2 dv = vec2(cos(th), sg * sin(th));
    float fs = 0.03 * sin(t * 0.9 + fi * 1.7 + seed);                 // each frond stirring on its own
    vec2 M = O + dv * l * 0.5 - vec2(0.0, (0.10 + fs) * l);
    vec2 E = O + dv * l * 0.92 - vec2(-fs * l, (0.40 + fs) * l);
    if (abs(q.x - O.x - 0.35 * l) > l * 0.85) continue;
    d = min(d, sgFrond(q, O, M, E, fi + seed * 7.0));
  }
  return d;
}

/* a giant cedar trunk in its own frame (x across in metres from its axis, y height above the ground) */
float sgTrunk(vec2 q, float r0, float seed){
  float r = r0 * (1.0 + 0.9 * exp(-q.y * 1.3)) + r0 * 0.10 * sin(q.y * 1.7 + seed);
  // buttress roots spreading at the foot
  float rootA = exp(-q.y * 2.4) * r0 * 1.5 * (0.5 + 0.5 * sin(q.x / r0 * 2.2 + seed * 3.0));
  return abs(q.x) - r - rootA * smoothstep(0.0, 0.3, r0 * 2.6 - abs(q.x) * 0.5);
}

/* one depth of forest: trunks, moss mounds at their feet. returns colour (misted) and coverage */
vec4 sgSlice(vec2 p, float z, float k, float t, float px){
  float gy = (p.y - SG_HZ) * z + SG_E;
  float pw = px * z;
  if (gy < -pw) return vec4(0.0);
  float X = p.x * z;
  float sx = sgStreamX(z);
  float CW = 4.2;
  float xs = X + k * 1.71;
  float ci = floor(xs / CW);
  float dT = 1e5, u = 0.0, rr = 1.0, xT = 0.0, dC = 1e5;
  for (int j = -1; j <= 1; j++){
    float id = ci + float(j);
    float h = hash11(id * 3.17 + k * 11.3);
    float xc = (id + 0.25 + 0.5 * hash11(id * 7.1 + k * 5.9)) * CW - k * 1.71;
    float r0 = 0.45 + 0.55 * h;
    if (abs(xc - sx) < r0 + 1.8 || hash11(id * 1.9 + k) < 0.25) continue;
    float d = sgTrunk(vec2(X - xc, gy), r0, h * 9.0);
    // its crown: the lowest boughs, tier on tier, each drooping at its tips
    float hb = SG_HC - 4.0 - 2.5 * hash11(id * 2.3 + k);
    float ax = abs(X - xc);
    float dr = 0.07 * ax * ax;                                   // the boughs droop toward their tips
    float tg = (gy - hb + dr) / (1.1 + 0.5 * h) + h * 0.37 + 0.10 * sin(gy * 0.9 + id) + 0.10 * n1(X * 6.0 + id * 3.0);
    float tier = fract(tg);
    float cw = (2.2 + 1.4 * h) * (1.0 - 0.38 * tier) * (1.0 - 0.04 * max(gy - hb, 0.0));
    cw += 0.30 * (pow(n1(gy * 6.0 + id * 3.1), 2.0) - 0.3);
    float dc = max(ax - cw, hb - dr - 0.25 * n1(X * 7.0 + id) - gy);
    dC = min(dC, dc);
    if (d < dT){ dT = d; u = (X - xc) / (r0 * (1.0 + 0.9 * exp(-gy * 1.3))); rr = r0; xT = xc; }
  }
  // moss mounds and ferns along the ground at this depth
  float dist = abs(X - sx);
  float hm = (0.10 + 0.45 * fbm1lo(X * 0.7 + k * 13.0)) * smoothstep(1.4, 3.0, dist);
  // moss cushions: rounded humps; fern fronds standing out of them
  float cush = 0.0;
  { float cc = floor(X / 0.7); for (int j = -1; j <= 1; j++){ float id = cc + float(j); float cx = (id + 0.5) * 0.7; float rad = 0.25 + 0.25 * hash11(id * 3.3 + k); cush = max(cush, sqrt(max(rad * rad - (X - cx) * (X - cx), 0.0)) * step(0.3, hash11(id + k * 7.0))); } }
  hm += cush * smoothstep(1.4, 3.0, dist);
  hm += 0.30 * pow(n1(X * 9.0 + k * 3.1), 6.0) * smoothstep(1.6, 3.2, dist);
  hm += 0.10 * pow(n1(X * 16.0 + k * 5.0), 4.0) * (1.0 - smoothstep(0.012, 0.03, pw)) * smoothstep(1.4, 3.0, dist);   // fronds
  float dM = max(gy - hm, -gy);
  float dF = dC;
  float cT = af(dT, pw), cM = af(dM, pw) * smoothstep(0.0, 0.35, gy + pw), cF = af(dF, pw);
  // above the canopy base the slice is inside the crowns: the canopy ceiling, drawn behind, stands in front
  float clip = af(gy - SG_HC, pw);
  cT *= clip; cF *= clip;
  if (max(max(cT, cM), cF) <= 0.0) return vec4(0.0);
  float near = exp(-z * 0.05);
  // bark: long fibrous ridges, moss climbing the lower trunk, a cool edge where the moonlight touches
  float fib = vnoise(vec2(u * 6.0 + k * 7.0, gy * 0.7)) * 0.65 + vnoise(vec2(u * 17.0, gy * 2.0)) * 0.35;
  vec3 bark = vec3(0.030, 0.024, 0.022) * (0.6 + 0.8 * fib) * (0.6 + 0.4 * sqrt(max(1.0 - u * u, 0.0)));
  float moss = smoothstep(0.38, 0.62, fbm4(vec2(u * 2.0 + k, gy * 0.6)) + smoothstep(3.0, 0.0, gy) * 0.35 - 0.1);
  bark = mix(bark, vec3(0.030, 0.065, 0.032) * (0.8 + 0.4 * fib), moss * 0.85);
  bark += SG_MOONC * smoothstep(0.50, 1.0, u) * 0.16 * near * (0.6 + 0.4 * fib);
  {  // beads of luminous moss in clusters
    vec2 gq = vec2(X - xT, gy) * 3.0;
    vec2 gi = floor(gq);
    float gd = length(fract(gq) - 0.5 - (hash22(gi) - 0.5) * 0.5);
    float clus = smoothstep(0.55, 0.75, vnoise(vec2(X - xT, gy) * 1.2 + k * 5.0));
    bark += vec3(0.30, 0.90, 0.70) * moss * clus * step(0.55, hash21(gi + k * 3.1)) * smoothstep(0.10, 0.04, gd) * 0.28 * near * (1.0 - smoothstep(0.015, 0.035, pw));
  }
  vec3 mc = vec3(0.020, 0.045, 0.024) * (0.75 + 0.5 * vnoise(vec2(X * 3.0, gy * 3.0))) + SG_MOONC * exp(-abs(dM) / max(pw * 2.0, 0.02)) * 0.08 * near;
  vec3 fc = vec3(0.007, 0.014, 0.013) * (0.7 + 0.6 * vnoise(vec2(X * 1.5, gy * 2.0)));
  fc += SG_MOONC * exp(-abs(dF) / max(pw * 1.5, 0.05)) * (0.04 + 0.30 * exp(-length(p - SG_MOON) * 5.0));
  vec3 rc = bark * cT; float ra = cT;
  rc = fc * cF + rc * (1.0 - cF); ra = cF + ra * (1.0 - cF);
  rc = mc * cM + rc * (1.0 - cM); ra = cM + ra * (1.0 - cM);
  vec3 c = mix(rc / max(ra, 1e-4), sgMist(p), sgMistF(z, gy));
  return vec4(c, ra);
}

/* the white stag: local frame in metres, origin on the ground under its forefeet, facing left */
float sgStag(vec2 q, float t){
  float bob = 0.015 * sin(t * 0.6);
  // a deep chest, a slim waist, strong haunches
  float d = sdEllipse(q - vec2(-0.16, 1.02), vec2(0.30, 0.24));
  d = smin(d, sdEllipse(q - vec2(0.18, 1.03), vec2(0.40, 0.19)), 0.10);
  d = smin(d, sdEllipse(q - vec2(0.55, 1.06), vec2(0.26, 0.23)), 0.10);
  // the neck rising and curving forward, the head held high
  vec2 n0 = vec2(-0.26, 1.16), n1 = vec2(-0.40, 1.42 + bob * 0.5), n2 = vec2(-0.50, 1.64 + bob);
  d = smin(d, min(sdTaper(q, n0, n1, 0.15, 0.11), sdTaper(q, n1, n2, 0.11, 0.085)), 0.06);
  vec2 hq = q - vec2(-0.58, 1.70 + bob);
  float head = sdEllipse(rot2(-0.35) * hq, vec2(0.15, 0.080));
  head = smin(head, sdTaper(q, vec2(-0.60, 1.70 + bob), vec2(-0.80, 1.60 + bob), 0.065, 0.034), 0.03);
  d = smin(d, head, 0.04);
  d = min(d, sdTaper(q, vec2(-0.52, 1.79 + bob), vec2(-0.40, 1.90 + bob), 0.034, 0.010));        // ear
  d = min(d, sdTaper(q, vec2(-0.56, 1.78 + bob), vec2(-0.62, 1.90 + bob), 0.026, 0.008));        // the far ear
  d = min(d, sdTaper(q, vec2(0.76, 1.16), vec2(0.82, 1.04), 0.050, 0.020));                      // tail
  // forelegs: forearm, knee, cannon, a small hoof; the far one a step behind
  d = smin(d, sdTaper(q, vec2(-0.20, 0.88), vec2(-0.21, 0.46), 0.070, 0.042), 0.03);
  d = min(d, sdTaper(q, vec2(-0.21, 0.46), vec2(-0.23, 0.05), 0.034, 0.026));
  d = min(d, sdTaper(q, vec2(-0.23, 0.06), vec2(-0.26, 0.0), 0.030, 0.022));
  d = smin(d, sdTaper(q, vec2(-0.04, 0.88), vec2(0.00, 0.47), 0.062, 0.040), 0.03);
  d = min(d, sdTaper(q, vec2(0.00, 0.47), vec2(0.04, 0.05), 0.032, 0.024));
  // hind legs: thigh, stifle, the hock bent back, a straight cannon
  d = smin(d, sdTaper(q, vec2(0.56, 0.98), vec2(0.50, 0.68), 0.14, 0.075), 0.05);
  d = min(d, sdTaper(q, vec2(0.50, 0.68), vec2(0.63, 0.44), 0.075, 0.042));
  d = min(d, sdTaper(q, vec2(0.63, 0.44), vec2(0.60, 0.04), 0.036, 0.026));
  d = smin(d, sdTaper(q, vec2(0.40, 0.96), vec2(0.36, 0.68), 0.11, 0.065), 0.04);
  d = min(d, sdTaper(q, vec2(0.36, 0.68), vec2(0.47, 0.45), 0.065, 0.038));
  d = min(d, sdTaper(q, vec2(0.47, 0.45), vec2(0.45, 0.05), 0.032, 0.024));
  return d;
}
/* antlers of light: two beams sweeping up and back from the crown, branching into tines */
float sgAntlers(vec2 q, float t){
  float bob = 0.015 * sin(t * 0.6);
  vec2 b = vec2(-0.54, 1.81 + bob);
  float d = 1e5;
  for (int s = 0; s < 2; s++){
    float sd = s == 0 ? 1.0 : -0.70;
    vec2 a0 = b + vec2(0.03 * sd, 0.0);
    vec2 a1 = a0 + vec2(0.16 * sd + 0.04, 0.30);
    vec2 a2 = a1 + vec2(0.07 * sd + 0.04, 0.30);
    vec2 a3 = a2 + vec2(-0.06 * sd, 0.22);
    d = min(d, sdTaper(q, a0, a1, 0.030, 0.022));
    d = min(d, sdTaper(q, a1, a2, 0.022, 0.016));
    d = min(d, sdTaper(q, a2, a3, 0.016, 0.006));
    d = min(d, sdTaper(q, mix(a0, a1, 0.25), mix(a0, a1, 0.25) + vec2(-0.16, 0.08), 0.016, 0.005));   // brow tine
    d = min(d, sdTaper(q, mix(a0, a1, 0.55), mix(a0, a1, 0.55) + vec2(-0.13, 0.12), 0.014, 0.004));
    d = min(d, sdTaper(q, mix(a1, a2, 0.35), mix(a1, a2, 0.35) + vec2(0.15 * sd, 0.10), 0.013, 0.004));
    d = min(d, sdTaper(q, mix(a1, a2, 0.85), mix(a1, a2, 0.85) + vec2(-0.10, 0.15), 0.012, 0.004));
    d = min(d, sdTaper(q, mix(a2, a3, 0.55), mix(a2, a3, 0.55) + vec2(0.12 * sd, 0.09), 0.010, 0.003));
  }
  return d;
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 p0 = p + m * vec2(0.004, 0.003);

  // the far forest dissolving into moonlit mist, the canopy closing overhead
  vec3 col = sgMist(p0);
  if (p0.y > SG_HZ) col = sgCanopy(p0 + m * vec2(0.004, 0.002), t, px);
  // a red gate standing deep in the mist across the stream
  {
    float zg = 30.0;
    vec2 q = vec2((p0.x + m.x * 0.004) * zg - (sgStreamX(zg) + 0.2), (p0.y - SG_HZ) * zg + SG_E);
    float pw = 0.13 + 0.025 * (1.0 - q.y / 3.9);
    float pil = min(sdBox(q - vec2(-1.3, 1.9), vec2(pw, 1.9)), sdBox(q - vec2(1.3, 1.9), vec2(pw, 1.9)));
    float ky = 3.95 + 0.030 * q.x * q.x;
    float kasagi = sdBox(q - vec2(0.0, ky), vec2(2.15 + 0.05 * step(0.0, q.y - ky), 0.15)) - 0.02;
    float cap = sdBox(q - vec2(0.0, ky + 0.10), vec2(2.20, 0.06));
    float nuki = sdBox(q - vec2(0.0, 3.40), vec2(1.70, 0.08));
    float strut = sdBox(q - vec2(0.0, 3.66), vec2(0.10, 0.20));
    float feet = min(sdBox(q - vec2(-1.3, 0.14), vec2(0.17, 0.14)), sdBox(q - vec2(1.3, 0.14), vec2(0.17, 0.14)));
    float gate = min(min(pil, kasagi), min(nuki, strut));
    vec3 red = vec3(0.62, 0.11, 0.06) * (0.75 + 0.35 * smoothstep(-0.2, 0.2, fract(q.x / 2.6 + 0.5) - 0.5));
    vec3 gc = mix(red, vec3(0.05, 0.03, 0.03), max(af(cap, px * zg), af(feet, px * zg)));
    gc = mix(gc, sgMist(p0), 1.0 - exp(-zg * 0.045));
    col = mix(col, gc, af(min(gate, min(cap, feet)), px * zg) * 0.9);
  }
  vec3 glowAcc = vec3(0.0);
  // the stream: dark water winding toward us, holding the moonlight and every spirit light; mossy stones on its banks
  vec2 pg = p + m * vec2(0.012, 0.005);
  float zS = 1e5;
  if (pg.y < SG_HZ){
    float z = SG_E / (SG_HZ - pg.y);
    float X = pg.x * z;
    float pw = px * z;
    float sx = sgStreamX(z);
    float ww = 0.9 + 0.35 * sin(z * 0.3);
    float dx = abs(X - sx);
    float water = smoothstep(ww + pw, ww - pw, dx + 0.15 * (vnoise(vec2(X * 2.0, z * 2.0)) - 0.5));
    {
      float lod = smoothstep(0.02, 0.2, pw);
      float mn = fbm4(vec2(X, z) * 0.9) * 0.7 + vnoise(vec2(X, z) * 6.0) * 0.3 * (1.0 - lod);
      vec3 floor_ = mix(vec3(0.016, 0.032, 0.020), vec3(0.040, 0.075, 0.040), smoothstep(0.30, 0.70, mn));
      floor_ = mix(floor_, vec3(0.05, 0.04, 0.03), smoothstep(0.62, 0.75, fbm4(vec2(X, z) * 0.5 + 7.0)) * 0.6);
      floor_ += SG_MOONC * smoothstep(0.6, 0.85, vnoise(vec2(X * 0.6, z * 0.4) + 3.0)) * 0.05;
      floor_ = mix(floor_, sgMist(pg), 1.0 - exp(-z * 0.055));
      col = mix(col, floor_, 1.0 - water);
    }
    if (water > 0.0 && z < 60.0){
      zS = z;
      float rip = vnoise(vec2(X * 3.0, z * 6.0 - t * 1.2)) - 0.5;
      // the mirrored world: mist, the moon's shafts, the gate, a ripple-broken glimmer
      vec2 mp = vec2(pg.x + rip * 0.010, SG_HZ + (SG_HZ - pg.y));
      vec3 wc = sgMist(mp) * 0.8 + vec3(0.02, 0.04, 0.05);
      wc += SG_MOONC * smoothstep(0.55, 0.9, vnoise(vec2(X * 4.0 + rip * 2.0, z * 3.0 - t * 0.8))) * 0.10;
      // the moon's path on the water, broken by the ripples
      vec2 mr = (mp - SG_MOON) / vec2(0.035, 0.10);
      float path = exp(-dot(mr, mr) * 1.5);
      float glit = smoothstep(0.50, 0.85, vnoise(vec2(X * 5.0, z * 22.0 - t * 1.4)));
      wc += vec3(0.85, 0.92, 1.0) * path * (0.15 + 1.4 * glit);
      wc *= 0.7 + 0.3 * smoothstep(0.0, ww, dx);
      wc = mix(wc, sgMist(pg), 1.0 - exp(-z * 0.05));
      col = mix(col, wc, water);
    }
    // mossy stones along the banks, and stepping stones across
    float bankD = abs(dx - ww);
    vec2 sq = vec2(X * 2.2, z * 1.4);
    vec2 sid = floor(sq);
    vec2 sc = sid + 0.5 + (hash22(sid) - 0.5) * 0.5;
    float sr = 0.28 + 0.15 * hash21(sid + 3.0);
    float stone = length((sq - sc) * vec2(1.0, 1.6)) - sr;
    float onBank = smoothstep(0.45, 0.10, bankD) * step(0.55, hash21(sid + 7.0));
    float step_ = smoothstep(0.22, 0.0, abs(z - 7.2)) * step(0.0, ww * 1.1 - dx) * step(0.4, fract(sq.x * 0.5));
    float stoneA = af(stone / 2.2, pw) * max(onBank, step_) * step(z, 30.0);
    vec2 sl = (sq - sc) * vec2(1.0, 1.6) / sr;
    float dome = sqrt(max(1.0 - dot(sl, sl), 0.0));
    vec3 stc = mix(vec3(0.07, 0.075, 0.075), vec3(0.03, 0.07, 0.035), smoothstep(0.35, 0.65, vnoise(sq * 3.0) + sl.y * 0.3));
    stc *= 0.45 + 0.75 * dome;
    stc += SG_MOONC * smoothstep(0.2, 0.9, sl.y + sl.x * 0.4) * dome * 0.10;
    stc = mix(stc, sgMist(pg), 1.0 - exp(-z * 0.05));
    col = mix(col, stc, stoneA);
  }

  // the forest, far to near
  float shaftT = 1.0;                                    // how much moonlit air lies in front: less before the near trunks
  for (int k = 0; k < 4; k++){
    float z = k == 0 ? 34.0 : k == 1 ? 24.0 : k == 2 ? 16.5 : k == 3 ? 11.5 : k == 4 ? 8.0 : 5.6;
    vec2 pk = p + m * vec2(0.004 + 0.06 / z, 0.003 + 0.02 / z);
    vec4 s = sgSlice(pk, z, float(k), t, px);
    col = mix(col, s.rgb, s.a);
    shaftT *= 1.0 - s.a * (k == 3 ? 0.35 : 0.0);
  }

  // the stone lantern on the right bank, its firebox glowing
  {
    float zl = 9.5;
    vec2 base = vec2((sgStreamX(zl) + 2.5) / zl, SG_HZ - SG_E / zl);
    vec2 q = (pg - base) * zl;                          // metres
    if (abs(q.x) < 0.7 && q.y > -0.1 && q.y < 2.0){
      float d = sdBox(q - vec2(0.0, 0.08), vec2(0.34, 0.08)) - 0.02;                // base
      d = min(d, sdBox(q - vec2(0.0, 0.50), vec2(0.10, 0.36)));                     // pillar
      d = min(d, sdBox(q - vec2(0.0, 0.92), vec2(0.30, 0.06)) - 0.01);              // platform
      float box = sdBox(q - vec2(0.0, 1.17), vec2(0.20, 0.19));
      d = min(d, box);
      vec2 rq = q - vec2(0.0, 1.42);
      float roof = max(abs(rq.x) - 0.42 + rq.y * 1.4, abs(rq.y - 0.04) - 0.10) - 0.01 * smoothstep(0.30, 0.42, abs(rq.x));
      d = min(d, roof);
      d = min(d, length(q - vec2(0.0, 1.64)) - 0.07);                                // finial
      float win = sdBox(q - vec2(0.0, 1.17), vec2(0.10, 0.11));
      vec3 lc = vec3(0.14, 0.15, 0.14) * (0.8 + 0.3 * vnoise(q * 12.0));
      lc = mix(lc, vec3(0.08, 0.16, 0.07), smoothstep(0.55, 0.75, vnoise(q * 7.0 + 3.0)) * 0.8);   // moss on the stone
      lc += vec3(1.0, 0.55, 0.20) * exp(-max(win, 0.0) * 18.0) * 0.30;
      float fl = 0.85 + 0.15 * sin(t * 9.0) * sin(t * 5.3);
      lc = mix(lc, vec3(1.0, 0.68, 0.30) * 1.6 * fl, af(win, px * zl));
      lc = mix(lc, sgMist(pg), 1.0 - exp(-zl * 0.05));
      col = mix(col, lc, af(d, px * zl));
    }
    vec2 lp = base + vec2(0.0, 1.17) / zl;
    float ld = length(pg - lp);
    glowAcc += vec3(1.0, 0.55, 0.20) * (exp(-ld * 28.0) * 0.35 + exp(-ld * 7.0) * 0.06);
  }

  // the white stag standing in the stream, antlers of light, its reflection trembling below
  {
    float zs = 10.5;
    vec2 base = vec2((sgStreamX(zs) - 0.1) / zs, SG_HZ - SG_E / zs);
    vec2 q = (pg - base) * zs;
    float pz = px * zs;
    if (abs(q.x) < 1.6 && q.y > -2.6 && q.y < 3.0){
      float d = sgStag(q, t);
      float an = sgAntlers(q, t);
      float glowF = 0.75 + 0.25 * sin(t * 0.9);
      vec3 sc = vec3(0.70, 0.82, 0.86) * (0.70 + 0.30 * smoothstep(0.5, 1.4, q.y));
      sc += SG_SPIRIT * exp(-max(-d, 0.0) * 16.0) * 0.45;
      col = mix(col, sc, af(d, pz) * 0.92);
      col += SG_SPIRIT * exp(-max(d, 0.0) * 8.0) * 0.12 * glowF;
      // motes of light lifting off its back
      vec2 mg = vec2(q.x * 9.0, q.y * 9.0 - t * 0.8);
      float mote = step(0.94, hash21(floor(mg))) * smoothstep(0.30, 0.0, length(fract(mg) - 0.5)) * smoothstep(0.6, 0.0, max(d, 0.0)) * step(1.0, q.y);
      col += SG_SPIRIT * mote * 0.8;
      col = mix(col, vec3(0.85, 1.0, 0.98) * 1.3, af(an, pz));
      col += SG_SPIRIT * exp(-max(an, 0.0) * 14.0) * 0.45 * glowF;
      // ripples ringing its legs where they meet the water
      float rings = exp(-abs(length(vec2(q.x - 0.2, q.y * 6.0)) - mod(t * 0.4, 1.0) * 1.2) * 18.0) * smoothstep(0.3, 0.0, abs(q.y)) * (1.0 - mod(t * 0.4, 1.0));
      col += SG_SPIRIT * rings * 0.25;
      // the reflection
      if (q.y < 0.0 && zS < 1e4){
        float wob = 0.035 * sin(q.y * 4.0 + t * 1.3) + 0.03 * (vnoise(vec2(q.y * 8.0 - t * 0.7, 2.0)) - 0.5);
        vec2 rq = vec2(q.x + wob, -q.y);
        float band = 0.35 + 0.65 * smoothstep(0.30, 0.62, vnoise(vec2(q.x * 1.2, q.y * 12.0 - t * 0.5)));
        float fade = exp(q.y * 0.55) * band;
        float rd = sgStag(rq, t);
        float ra = sgAntlers(rq, t);
        col = mix(col, vec3(0.48, 0.60, 0.64), af(rd, pz * 2.5) * 0.26 * fade);
        col += SG_SPIRIT * (af(ra, pz * 2.5) * 0.22 + exp(-max(ra, 0.0) * 10.0) * 0.07) * fade;
      }
    }
  }

  // the nearest trees
  for (int k = 4; k < 6; k++){
    float z = k == 0 ? 34.0 : k == 1 ? 24.0 : k == 2 ? 16.5 : k == 3 ? 11.5 : k == 4 ? 8.0 : 5.6;
    vec2 pk = p + m * vec2(0.004 + 0.06 / z, 0.003 + 0.02 / z);
    vec4 s = sgSlice(pk, z, float(k), t, px);
    col = mix(col, s.rgb, s.a);
    shaftT *= 1.0 - s.a * (k == 4 ? 0.5 : 0.65);
  }

  // the sacred cedar in the foreground: a vast trunk girdled with a straw rope and zigzag paper streamers
  vec2 pf = p + m * vec2(0.05, 0.02);
  {
    float tx = -0.5 * asp + 0.06 + 0.015 * sin(pf.y * 3.0);
    float tw = 0.17 + 0.05 * smoothstep(-0.2, -0.5, pf.y) + 0.01 * sin(pf.y * 9.0 + 1.0);
    float dT = abs(pf.x - tx) - tw;
    float u = (pf.x - tx) / tw;
    if (dT < px * 2.0){
      float fib = vnoise(vec2(u * 7.0, pf.y * 6.0)) * 0.6 + vnoise(vec2(u * 19.0, pf.y * 14.0)) * 0.4;
      vec3 bark = vec3(0.030, 0.022, 0.020) * (0.55 + 0.8 * fib) * (0.50 + 0.50 * sqrt(max(1.0 - u * u, 0.0)));
      float moss = smoothstep(0.42, 0.66, fbm4(vec2(u * 2.0, pf.y * 4.0)) + smoothstep(-0.1, -0.45, pf.y) * 0.3);
      bark = mix(bark, vec3(0.030, 0.062, 0.030) * (0.7 + 0.5 * fib), moss * 0.85);
      bark += SG_MOONC * smoothstep(0.45, 1.0, u) * 0.22 * (0.5 + 0.5 * fib);
      {
        vec2 gq = vec2(pf.x - tx, pf.y) * 55.0;
        vec2 gi = floor(gq);
        float gd = length(fract(gq) - 0.5 - (hash22(gi) - 0.5) * 0.5);
        float clus = smoothstep(0.62, 0.82, vnoise(vec2(pf.x - tx, pf.y) * 9.0 + 2.0));
        bark += vec3(0.25, 0.90, 0.70) * moss * clus * step(0.72, hash21(gi)) * smoothstep(0.14, 0.06, gd) * 0.30;
      }
      // the rope: twisted straw, thick, a band around the trunk
      float ry = pf.y - (0.06 + 0.014 * u * u);
      const float RH = 0.026;
      float rope = smoothstep(RH, RH - 0.003, abs(ry));
      float cyl = sqrt(max(1.0 - (ry / RH) * (ry / RH), 0.0));                      // round in section
      float tw2 = fract(asin(clamp(u, -1.0, 1.0)) * 1.7 + ry * 32.0);                  // strands twisting around the trunk
      float strand = smoothstep(0.0, 0.16, tw2) * smoothstep(1.0, 0.72, tw2);
      vec3 rc = mix(vec3(0.16, 0.13, 0.08), vec3(0.58, 0.51, 0.33), strand * (0.30 + 0.70 * cyl));
      rc += vec3(0.25, 0.21, 0.12) * pow(vnoise(vec2(u * 70.0, ry * 500.0)), 3.0) * 0.30 * strand;   // straw fibres
      rc *= 0.40 + 0.60 * sqrt(max(1.0 - u * u, 0.0));
      rc += SG_MOONC * smoothstep(0.1, 1.0, ry / RH) * cyl * strand * 0.10;
      rc += SG_MOONC * smoothstep(0.45, 1.0, u) * 0.12;
      bark = mix(bark, rc, rope);
      col = mix(col, bark, af(dT, px));
      shaftT *= 1.0 - 0.8 * af(dT, px);
    }
    // shide: folded paper streamers hanging from the rope, stepping side to side, stirring in the air
    for (int i = 0; i < 4; i++){
      float fi = float(i);
      float sxp = tx + (fi - 1.5) * tw * 0.55;
      float uu = (sxp - tx) / tw;
      if (sxp < -0.5 * asp - 0.02) continue;
      vec2 q = pf - vec2(sxp + 0.003 * sin(t * 0.8 + fi), 0.06 + 0.014 * uu * uu - 0.020);
      if (q.y > 0.004 || q.y < -0.125 || abs(q.x) > 0.035) continue;
      const float SH = 0.027;
      float seg = clamp(floor(-q.y / SH), 0.0, 3.0);
      float sway = 0.0025 * sin(t * 1.3 + fi * 1.9) * seg;
      float off = (mod(seg, 2.0) < 0.5 ? -1.0 : 1.0) * 0.0050;
      float paper = sdBox(q - vec2(off + sway, -(seg + 0.5) * SH), vec2(0.0062, SH * 0.5 + 0.0005));
      vec3 pc = vec3(0.50, 0.54, 0.56) * (mod(seg, 2.0) < 0.5 ? 1.0 : 0.66) * (0.75 + 0.25 * sqrt(max(1.0 - uu * uu, 0.0))) + SG_MOONC * 0.05;
      col = mix(col, pc, af(paper, px) * 0.95);
    }
  }

  // cedar boughs close overhead, black against the moonlit gap, their needles rimmed with light
  {
    vec2 pb = p + m * vec2(0.05, 0.02);
    float ex = 0.5 * asp - 0.80;                       // how much wider than 16:10 the window is
    float d = sgBough(pb, vec2(-0.70 - ex, 0.45), -0.10, 0.50, 1.0, t);
    d = min(d, sgBough(pb, vec2(-0.68 - ex, 0.58), -0.45, 0.36, 2.0, t));
    vec2 pr = vec2(-pb.x, pb.y);
    d = min(d, sgBough(pr, vec2(-0.86 - ex, 0.52), -0.12, 0.72 + ex, 3.0, t));
    d = min(d, sgBough(pr, vec2(-0.86 - ex, 0.34), 0.02, 0.34, 4.0, t));
    if (d < 0.03){
      float back = 0.04 + 0.8 * exp(-length(pb - SG_MOON) * 5.0);
      vec3 bc = vec3(0.004, 0.008, 0.007) + SG_MOONC * smoothstep(-px * 1.0, 0.0, d) * back * 0.22;
      col = mix(col, bc, af(d, px));
      col += SG_MOONC * exp(-max(d, 0.0) / 0.008) * back * 0.04;
    }
  }

  // moonlight slanting down through the canopy into the mist
  vec2 sd = p0 - SG_MOON;
  float ang = atan(sd.x, -sd.y);                                   // 0 straight down
  float shafts = smoothstep(0.50, 0.95, n1(ang * 11.0 + 3.0 + t * 0.01)) * 0.75 + smoothstep(0.65, 1.0, n1(ang * 27.0 - t * 0.012)) * 0.25;
  shafts *= smoothstep(0.08, 0.30, length(sd)) * exp(-length(sd) * 1.3) * smoothstep(1.0, 0.45, abs(ang)) * smoothstep(0.30, 0.15, p0.y);
  col += SG_MOONC * shafts * 0.17 * shaftT;
  col += glowAcc;

  // spirit lights drifting among the trees, trailing faint light; their glimmer in the stream
  for (int i = 0; i < 22; i++){
    float fi = float(i);
    float h1 = hash11(fi * 3.7), h2 = hash11(fi * 5.9), h3 = hash11(fi * 2.3);
    float z = 4.0 + 22.0 * h2;
    float sc = 1.0 / z;
    vec2 wp = vec2((h1 - 0.5) * 1.5 + 0.10 * sin(t * (0.10 + 0.08 * h3) + fi * 2.0), -0.10 + 0.45 * h3 * sc * 6.0 + 0.04 * sin(t * (0.22 + 0.1 * h1) + fi));
    wp.y = SG_HZ + (wp.y - SG_HZ) * 0.6 - 0.05;
    vec2 sp = wp + m * vec2(0.004 + 0.06 * sc, 0.003 + 0.02 * sc);
    vec2 dq = p - sp;
    float r = 0.0045 + 0.040 * sc;
    if (dot(dq, dq) > r * r * 60.0) continue;
    float d = length(dq);
    float pulse = 0.70 + 0.30 * sin(t * (1.0 + h1) + fi * 4.0);
    vec3 wc = mix(SG_SPIRIT, vec3(1.0, 0.85, 0.65), step(0.80, h2));
    col += wc * (exp(-d * d / (r * r * 0.25)) * 1.0 + exp(-d / (r * 1.2)) * 0.25) * pulse;
    // a short trail behind its drift
    vec2 vel = vec2(cos(t * (0.10 + 0.08 * h3) + fi * 2.0) * (0.10 + 0.08 * h3) * 0.10, 0.0);
    float tr = sdSeg(p, sp, sp - normalize(vel + vec2(1e-4, 0.0)) * r * 4.0);
    col += wc * exp(-tr / (r * 0.35)) * 0.12 * pulse;
  }
  // fireflies low over the moss
  for (int i = 0; i < 14; i++){
    float fi = float(i);
    vec2 fp = vec2((hash11(fi * 7.3) - 0.5) * 1.5 + 0.03 * sin(t * 0.5 + fi), -0.18 - 0.25 * hash11(fi * 1.7) + 0.02 * sin(t * 0.7 + fi * 2.0));
    float d = length(p - fp);
    if (d > 0.02) continue;
    float blink = pow(max(0.0, sin(t * (0.6 + hash11(fi) * 0.5) + fi * 2.7)), 8.0);
    col += vec3(0.85, 1.0, 0.45) * blink * (exp(-d * d / 0.000003) * 1.2 + exp(-d / 0.006) * 0.12);
  }

  // a fallen log across the bottom right, mushrooms on it glowing
  {
    vec2 q = pf - vec2(0.48, -0.47);
    vec2 lq = rot2(0.12) * q;
    float lg = abs(lq.y) - 0.045 - 0.006 * sin(lq.x * 30.0);
    lg = max(lg, -lq.x - 0.30);
    if (lg < px * 2.0){
      vec3 lc = vec3(0.05, 0.04, 0.035) * (0.7 + 0.5 * vnoise(vec2(lq.x * 30.0, lq.y * 90.0)));
      lc = mix(lc, vec3(0.06, 0.13, 0.06), smoothstep(0.3, 0.7, vnoise(lq * 20.0)) * smoothstep(0.0, 0.04, lq.y) * 0.8);
      lc += SG_MOONC * smoothstep(0.035, 0.045, lq.y) * 0.12;
      col = mix(col, lc, af(lg, px));
    }
    for (int i = 0; i < 7; i++){
      float fi = float(i);
      vec2 mc = vec2(-0.22 + fi * 0.06 + 0.02 * hash11(fi), 0.045);
      vec2 mq = lq - mc;
      float cs = 0.010 + 0.008 * hash11(fi * 3.0);
      float cap = max(length(mq * vec2(1.0, 1.8)) - cs, -mq.y);
      float stem = max(abs(mq.x) - cs * 0.25, max(mq.y, -mq.y - cs * 0.9));
      float md = min(cap, stem);
      vec3 mcol = mix(vec3(0.20, 0.95, 0.85), vec3(0.65, 0.45, 1.0), step(0.6, hash11(fi * 5.0)));
      col = mix(col, mcol * (0.6 + 0.4 * smoothstep(0.0, cs, mq.y)), af(md, px));
      col += mcol * exp(-length(mq) / (cs * 2.0)) * 0.15;
    }
  }

  col = filmic(col * 1.25);
  col = grade(col, vec3(0.88, 1.0, 1.08), vec3(1.0, 1.0, 0.94), 0.45);
  return col;
}`;
