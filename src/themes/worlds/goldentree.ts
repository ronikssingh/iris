/* Golden Tree: a colossal tree of light on the horizon, gold drifting down over misted ruins. */

export const goldentree = /* glsl */ `
const float GT_HZ = -0.10;
const vec2 GT_BASE = vec2(0.20, -0.10);

/* the great tree: x = distance to trunk and limbs, y = canopy light */
vec2 gtTree(vec2 p, float t){
  vec2 q = p - GT_BASE;
  float d = 1e5;
  // the trunk: strands spiralling around one another, flaring into roots at the foot
  float y = clamp(q.y, -0.01, 0.28);
  float k = clamp(y / 0.28, 0.0, 1.0);
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    float ph = fi * 1.0472 + y * 14.0;
    float rad = mix(0.050, 0.020, pow(k, 0.6)) + 0.03 * exp(-y * 40.0);
    float x = sin(ph) * rad;
    float depth = cos(ph);
    float w = mix(0.012, 0.006, k) * (0.8 + 0.25 * depth);
    float sd = abs(q.x - x) - w;
    sd = max(sd, max(-q.y - 0.005, q.y - 0.285));
    d = min(d, sd);
  }
  // great limbs arching outward and upward, forking into twigs
  if (q.y > 0.20){
    for (int i = 0; i < 11; i++){
      float fi = float(i);
      float a = mix(-1.35, 1.35, fi / 10.0) + 0.08 * sin(fi * 3.7);
      vec2 s0 = vec2(sin(a) * 0.012, 0.27);
      float L = 0.34 + 0.12 * (1.0 - abs(a) / 1.35) + 0.04 * hash11(fi);
      vec2 dir = normalize(vec2(sin(a) * 1.25, 0.55 + 0.65 * cos(a)));
      vec2 s1 = s0 + dir * L * 0.45 + vec2(0.0, 0.035);
      vec2 s2 = s0 + dir * L + vec2(sin(a) * 0.05, 0.0);
      d = min(d, min(sdTaper(q, s0, s1, 0.0085, 0.0055), sdTaper(q, s1, s2, 0.0055, 0.0015)));
      for (int j = 0; j < 3; j++){
        float fj = float(j);
        vec2 b0 = mix(s1, s2, 0.25 + fj * 0.25);
        vec2 bd = rot2((fj - 1.0) * 0.55 + (hash11(fi * 3.0 + fj) - 0.5) * 0.4) * dir;
        vec2 b1 = b0 + bd * L * (0.22 - fj * 0.04);
        d = min(d, sdTaper(q, b0, b1, 0.003, 0.0008));
      }
    }
  }
  // the canopy: clumps of golden leaf-light in a vast dome, and strands of light hanging beneath
  vec2 cq = (q - vec2(0.0, 0.50)) / vec2(0.78, 0.30);
  float cl = length(cq);
  float n = fbm4(q * 7.0 + vec2(t * 0.02, -t * 0.012));
  float dome = smoothstep(1.05, 0.62, cl + (n - 0.5) * 0.5) * smoothstep(-0.95, -0.40, cq.y);
  float f1 = fbm4(q * 24.0 + vec2(t * 0.03, -t * 0.01));
  float f2 = vnoise(q * 85.0 + vec2(0.0, t * 0.05));
  float clump = smoothstep(0.38, 0.78, f1) * 0.75 + smoothstep(0.45, 0.95, f2) * 0.25 * smoothstep(0.35, 0.6, f1);
  vec2 sg = q * 180.0;
  float sparkle = smoothstep(0.12, 0.0, length(fract(sg) - hash22(floor(sg)))) * step(0.93, hash21(floor(sg) + floor(t * 1.5)));
  float canopy = dome * (0.30 + 0.70 * clump) + dome * sparkle * 2.0;
  // hanging strands, like a willow made of light
  float hang = smoothstep(0.55, 0.95, n1(q.x * 140.0 + 3.0)) * smoothstep(0.26, 0.36, q.y) * (1.0 - smoothstep(0.36, 0.50, q.y)) * smoothstep(0.65, 0.25, abs(q.x) / 0.65);
  canopy += hang * 0.6 * (0.6 + 0.4 * sin(q.y * 80.0 - t * 2.0));
  return vec2(d, canopy);
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 p0 = p + m * vec2(0.004, 0.003);
  vec2 p1 = p + m * vec2(0.010, 0.005);
  vec2 p2 = p + m * vec2(0.020, 0.008);
  vec2 p3 = p + m * vec2(0.034, 0.012);

  // a deep violet dusk, and the tree's gold pouring into it
  float h = p0.y - GT_HZ;
  vec3 col = mix(vec3(0.26, 0.18, 0.30), vec3(0.035, 0.035, 0.10), smoothstep(0.0, 0.55, h));
  float tg = length((p0 - vec2(GT_BASE.x, 0.36)) * vec2(0.62, 0.9));
  col += vec3(1.0, 0.62, 0.22) * exp(-tg * 3.0) * 0.40 + vec3(1.0, 0.80, 0.45) * exp(-tg * 7.0) * 0.25;
  // clouds, their sides toward the tree catching gold
  vec2 cq = vec2(p0.x * 1.3 + t * 0.005, p0.y * 3.2);
  float cd = fbm(cq + vec2(fbm3(cq * 0.9 - t * 0.004), 0.0) * 1.2);
  vec2 toT = normalize(vec2(GT_BASE.x, 0.3) - p0);
  float cu = fbm3(cq + vec2(toT.x * 0.08, toT.y * 0.25));
  float lit = clamp((cd - cu) * 6.0 + 0.45, 0.0, 1.0);
  float glowT = exp(-tg * 2.4);
  vec3 cc = mix(vec3(0.07, 0.06, 0.13), vec3(0.24, 0.18, 0.28), lit * 0.6);
  cc = mix(cc, vec3(1.0, 0.70, 0.32) * (0.6 + lit * 0.8), glowT * (0.4 + 0.6 * lit));
  col = mix(col, cc, smoothstep(0.46, 0.76, cd) * smoothstep(0.04, 0.2, h) * 0.85);
  col += starfield(p0, 70.0, 0.97, t, px) * smoothstep(0.35, 0.6, h) * (1.0 - glowT) * 0.6;

  // the tree
  if (abs(p1.x - GT_BASE.x) < 0.85 && p1.y > GT_HZ - 0.02){
    vec2 tr = gtTree(p1, t);
    vec3 gold = vec3(1.0, 0.74, 0.32);
    col += gold * tr.y * 0.95;
    col += vec3(1.0, 0.92, 0.65) * tr.y * tr.y * 0.55;
    float limb = af(tr.x, px);
    col = mix(col, vec3(1.0, 0.86, 0.52) * 2.2, limb * 0.92);
    col += gold * exp(-max(tr.x, 0.0) * 130.0) * 0.35;
  }
  // veils of cloud drifting in front of the tree: it stands far beyond them
  float veil = smoothstep(0.55, 0.85, fbm4(vec2(p0.x * 2.2 - t * 0.008, p0.y * 9.0 + 2.0))) * smoothstep(0.02, 0.10, h) * (1.0 - smoothstep(0.30, 0.45, h));
  col = mix(col, mix(vec3(0.16, 0.12, 0.20), vec3(0.9, 0.62, 0.32), glowT * 0.7), veil * 0.55);
  // gold drifting down from the boughs like slow snow
  for (int i = 0; i < 30; i++){
    float fi = float(i);
    float sp = 0.010 + 0.010 * hash11(fi * 3.1);
    float x0 = GT_BASE.x + (hash11(fi) - 0.5) * 1.3;
    float y0 = mod(0.40 - t * sp + hash11(fi * 7.0) * 0.7, 0.75) - 0.30;
    vec2 lp = vec2(x0 + 0.025 * sin(t * 0.5 + fi * 2.0), y0);
    float ld = length(p1 - lp);
    col += vec3(1.0, 0.82, 0.45) * (exp(-ld * 800.0) * 1.0 + exp(-ld * 140.0) * 0.07);
  }

  // the far plain, the tree's roots sunk in golden haze
  float far = GT_HZ + 0.010 * fbm1lo(p1.x * 4.0) + 0.04 * smoothstep(-0.2, -0.9, p1.x) + 0.02 * smoothstep(0.6, 1.0, p1.x);
  vec3 farc = mix(vec3(0.10, 0.08, 0.14), vec3(0.70, 0.46, 0.22), exp(-abs(p1.x - GT_BASE.x) * 3.5) * 0.7);
  col = mix(col, farc, af(p1.y - far, px));
  float hm = exp(-abs(p1.y - GT_HZ - 0.004) * 26.0);
  col = mix(col, vec3(0.95, 0.66, 0.32), hm * 0.55 * (0.35 + 0.65 * exp(-abs(p1.x - GT_BASE.x) * 2.2)));

  // the ruins of a great hall: broken pointed arches and a shattered tower, gold along their edges
  {
    vec2 q = p2;
    float gy = -0.165 + 0.01 * fbm1lo(q.x * 6.0);
    float d = 1e5;
    for (int i = 0; i < 6; i++){
      float fi = float(i);
      float ax = -0.84 + fi * 0.10;
      float standing = hash11(fi * 3.3) > 0.3 ? 1.0 : 0.0;
      float hgt = (0.17 + 0.03 * sin(fi * 2.0)) * (standing > 0.5 ? 1.0 : 0.40);
      float pier = max(abs(q.x - ax) - 0.011, max(q.y - gy - hgt + 0.012 * n1(q.x * 300.0) * (1.0 - standing), gy - q.y));
      pier = min(pier, max(abs(q.x - ax) - 0.016, max(q.y - gy - 0.012, gy - q.y)));
      d = min(d, pier);
      if (standing > 0.5 && i < 5 && hash11(fi * 3.3 + 3.3) > 0.3){
        vec2 aq = q - vec2(ax + 0.05, gy + hgt);
        float o1 = length(aq - vec2(-0.018, 0.0)) - 0.068;
        float o2 = length(aq - vec2(0.018, 0.0)) - 0.068;
        float outer = max(max(o1, o2), max(-aq.y, abs(aq.x) - 0.062));
        float inner = max(length(aq - vec2(-0.018, 0.0)) - 0.054, length(aq - vec2(0.018, 0.0)) - 0.054);
        float arch = max(outer, -inner);
        arch = max(arch, -(aq.x - 0.03 + 0.03 * fi * 0.0) * step(4.0, fi));      // the last arch broken off
        d = min(d, arch);
      }
    }
    // the tower: tall, its top torn away, a lancet window glowing with sky
    float tx = -0.30;
    float top = gy + 0.30 - 0.06 * smoothstep(tx - 0.03, tx + 0.04, q.x) + 0.02 * n1(q.x * 200.0);
    float tw = max(abs(q.x - tx) - 0.038, max(q.y - top, gy - q.y));
    float win = max(abs(q.x - tx) - 0.009, abs(q.y - gy - 0.20) - 0.028);
    win = min(win, length(q - vec2(tx, gy + 0.228)) - 0.009);
    tw = max(tw, -win);
    d = min(d, tw);
    vec2 toTree = normalize(GT_BASE - q);
    vec3 rc = vec3(0.07, 0.055, 0.075) + vec3(1.0, 0.68, 0.30) * exp(-abs(d) * 600.0) * 0.55;
    rc *= 0.85 + 0.25 * fbm4(q * 60.0);
    col = mix(col, rc, af(d, px));
  }
  // mist pooled among the ruins, lit gold toward the tree
  float mm = exp(-abs(p2.y + 0.155) * 13.0) * smoothstep(0.3, 0.8, fbm4(vec2(p2.x * 3.0 - t * 0.02, p2.y * 9.0)));
  col = mix(col, mix(vec3(0.35, 0.28, 0.36), vec3(0.95, 0.68, 0.36), exp(-abs(p2.x - GT_BASE.x) * 1.8)), mm * 0.45);

  // the near field: dark grass rimmed with gold, a worn road running toward the tree
  float fy = -0.25 + 0.025 * fbm1lo(p3.x * 3.0) - 0.07 * smoothstep(0.25, 0.95, abs(p3.x - 0.1));
  if (p3.y < fy + 0.07){
    float dd = fy - p3.y;
    float z = 0.12 / (dd + 0.02);
    float road = smoothstep(0.10, 0.06, abs(p3.x * z - 0.18 * z * 0.0 - (0.05 + 0.10 * sin(z * 0.8)) * 1.0) / max(z, 1.0) * z * 0.25);
    vec3 grass = mix(vec3(0.22, 0.15, 0.10), vec3(0.04, 0.035, 0.05), smoothstep(0.0, 0.12, dd));
    grass *= 0.8 + 0.35 * fbm4(vec2(p3.x * 30.0 + sin(p3.y * 40.0 + t) * 0.3, p3.y * 60.0));
    grass += vec3(1.0, 0.68, 0.30) * exp(-dd * 30.0) * 0.30;
    float cell = 0.006;
    float cg = floor(p3.x / cell);
    float g = 1e5;
    for (int k = -1; k <= 1; k++){
      float id = cg + float(k);
      float hx = (id + hash11(id)) * cell;
      float gh = 0.02 + 0.035 * hash11(id * 3.1);
      float yy = (p3.y - fy) / gh;
      if (yy < 0.0 || yy > 1.0) continue;
      float bend = 0.3 + 0.25 * sin(t * 1.1 + hx * 7.0);
      g = min(g, abs(p3.x - hx - bend * gh * yy * yy) - cell * 0.2 * (1.0 - yy));
    }
    float gm = min(p3.y - fy, g);
    vec3 gc = mix(grass, vec3(1.0, 0.72, 0.32) * 0.9, smoothstep(0.0, -0.004, gm) * exp(-abs(gm) * 400.0) * step(0.0, p3.y - fy + 0.001));
    col = mix(col, gc, af(gm, px));
  }
  // broken columns standing in the grass
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    vec2 cb = vec2(-0.12 + fi * 0.38 + 0.08 * sin(fi * 4.0), -0.52 + 0.06 * fi);
    float ch = 0.22 - fi * 0.055;
    float slope = (hash11(fi) - 0.5) * 0.8;
    float cd2 = max(abs(p3.x - cb.x) - 0.026, max(p3.y - cb.y - ch - slope * (p3.x - cb.x), cb.y - p3.y));
    cd2 = min(cd2, sdBox(p3 - cb - vec2(0.0, 0.008), vec2(0.036, 0.009)));
    float flute = smoothstep(0.35, 0.5, abs(fract((p3.x - cb.x) * 110.0) - 0.5));
    vec3 stc = vec3(0.06, 0.05, 0.065) * (0.85 + 0.3 * flute);
    stc += vec3(1.0, 0.70, 0.32) * exp(-abs(cd2) * 500.0) * 0.45 * smoothstep(cb.x - 0.03, cb.x + 0.03, p3.x + (GT_BASE.x > cb.x ? 0.0 : 0.06));
    col = mix(col, stc, af(cd2, px));
  }

  col = filmic(col * 1.1);
  col = grade(col, vec3(0.90, 0.92, 1.12), vec3(1.06, 1.0, 0.88), 0.55);
  return col;
}`;
