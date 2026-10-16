/* The Deep: sunlight falling through blue water, caustics on the sand, a humpback gliding overhead. */

export const thedeep = /* glsl */ `
/* bright webs of focused light, as on the floor of a sunny shallow sea */
float tdCaustic(vec2 p, float t){
  vec2 q = p;
  float c = 0.0;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    q += vec2(sin(q.y * 1.7 + t * 0.6 + fi * 1.3), cos(q.x * 1.5 - t * 0.5 + fi * 2.1)) * 0.45;
    c += 1.0 / (1.0 + 18.0 * abs(sin(q.x * 1.3 + q.y * 0.6) * sin(q.y * 1.1 - q.x * 0.4)));
  }
  return c / 3.0;
}

/* a humpback in its own frame: head toward +x, body length 1 */
float tdWhale(vec2 q, float t){
  float flick = 0.18 * sin(t * 0.55);
  // body: deep in the chest, tapering to a slender tail stock; the belly hangs lower than the back
  float d = sdTaper(q, vec2(-0.12, 0.012), vec2(0.18, -0.004), 0.080, 0.108);
  d = smin(d, sdTaper(q, vec2(0.18, -0.004), vec2(0.48, 0.006), 0.108, 0.040), 0.07);
  d = smin(d, sdTaper(q, vec2(0.10, -0.035), vec2(0.44, -0.018), 0.075, 0.035), 0.05);   // throat
  d = smin(d, sdTaper(q, vec2(-0.12, 0.012), vec2(-0.44, 0.018 + flick * 0.06), 0.080, 0.026), 0.05);
  // knobbles along the head
  for (int k = 0; k < 4; k++){
    d = min(d, sdCircle(q - vec2(0.33 + float(k) * 0.035, 0.048 - float(k) * 0.008), 0.009));
  }
  // flukes, rising and falling slowly
  vec2 tq = rot2(flick) * (q - vec2(-0.44, 0.012));
  float fl = min(sdTri(tq, vec2(0.0, 0.0), vec2(-0.10, 0.11), vec2(-0.14, 0.085)), sdTri(tq, vec2(0.0, 0.0), vec2(-0.10, -0.10), vec2(-0.14, -0.072)));
  fl = min(fl, sdTri(tq, vec2(0.02, 0.0), vec2(-0.10, 0.11), vec2(-0.08, -0.10)));
  fl = max(fl, -sdCircle(tq - vec2(-0.155, 0.0), 0.03));
  d = min(d, fl);
  // the long pectoral fin, its leading edge knobbled
  float fa = -0.55 + 0.10 * sin(t * 0.4);
  vec2 f0 = vec2(0.22, -0.06);
  vec2 fdir = vec2(cos(fa - 1.2), sin(fa - 1.2));
  vec2 f1 = f0 + fdir * 0.30;
  float fin = sdTaper(q, f0, f1, 0.042, 0.010);
  vec2 fq = q - f0;
  float along = clamp(dot(fq, fdir) / 0.30, 0.0, 1.0);
  fin -= 0.006 * max(0.0, sin(along * 40.0)) * step(0.0, dot(fq, vec2(fdir.y, -fdir.x)));
  d = min(d, fin);
  // the far fin, mostly hidden behind the body
  d = min(d, sdTaper(q, vec2(0.20, 0.03), vec2(0.06, 0.20), 0.030, 0.008));
  // a small dorsal hump
  d = min(d, sdTri(q, vec2(-0.16, 0.08), vec2(-0.05, 0.095), vec2(-0.12, 0.13)));
  return d;
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 p0 = p + m * vec2(0.006, 0.004);
  vec2 p1 = p + m * vec2(0.014, 0.006);
  vec2 p2 = p + m * vec2(0.024, 0.009);

  // the water: bright toward the surface, ink-blue below
  float yy = p0.y;
  vec3 col = mix(vec3(0.004, 0.035, 0.075), vec3(0.02, 0.22, 0.32), smoothstep(-0.55, 0.15, yy));
  col = mix(col, vec3(0.20, 0.62, 0.70), smoothstep(0.15, 0.48, yy));
  // the surface seen from below: a rippling silver ceiling, the sun a smear of light
  float surf = 0.36 + 0.012 * sin(p0.x * 9.0 + t * 0.8) + 0.008 * sin(p0.x * 23.0 - t * 1.3);
  if (p0.y > surf - 0.02){
    float k = smoothstep(surf - 0.02, surf + 0.02, p0.y);
    float rip = tdCaustic(vec2(p0.x * 9.0, (p0.y - surf) * 30.0 + 3.0), t * 1.2);
    float win = exp(-length((p0 - vec2(-0.22, 0.50)) * vec2(0.8, 1.6)) * 2.2);
    vec3 sc = mix(vec3(0.10, 0.40, 0.48), vec3(0.55, 0.90, 0.92), win) + vec3(0.7, 0.9, 0.9) * rip * (0.25 + 0.7 * win);
    sc += vec3(1.0, 0.98, 0.85) * exp(-length((p0 - vec2(-0.22, 0.50)) * vec2(1.0, 2.0)) * 5.0) * 1.5;
    col = mix(col, sc, k);
  }
  col += vec3(0.9, 1.0, 0.9) * exp(-length((p0 - vec2(-0.22, 0.42)) * vec2(1.0, 1.4)) * 3.0) * 0.30;

  // shafts of light slanting down from the surface, shifting with the waves above
  float slant = 0.32;
  float bx = p1.x + (p1.y - 0.40) * slant;
  float shafts = pow(fbm1(bx * 7.0 + t * 0.05), 3.0) * 2.4 + pow(n1(bx * 23.0 - t * 0.12), 4.0) * 0.8;
  float shaftFade = smoothstep(-0.55, 0.35, p1.y) * (0.6 + 0.4 * exp(-abs(bx + 0.22) * 2.0));
  col += vec3(0.55, 0.85, 0.85) * shafts * shaftFade * 0.22;

  // the whale: a vast shadow against the light, gliding past overhead
  float cyc = mod(t, 110.0);
  float wx = mix(-1.55, 1.55, cyc / 85.0);
  vec2 wp = vec2(wx, 0.19 + 0.03 * sin(t * 0.09));
  float WS = 0.95;
  vec2 wq = rot2(-0.06 + 0.03 * sin(t * 0.2)) * (p0 - wp) / WS;
  if (abs(wq.x) < 0.75 && abs(wq.y) < 0.45){
    float d = tdWhale(wq, t);
    float cov = af(d, px / WS);
    float top = smoothstep(-0.06, 0.08, wq.y);
    vec3 wc = mix(vec3(0.02, 0.07, 0.10), vec3(0.06, 0.16, 0.20), top);
    // throat pleats on the belly, light-edged
    float pleat = step(wq.y, -0.02) * step(-0.10, wq.y) * step(0.15, wq.x) * smoothstep(0.75, 1.0, sin(wq.y * 260.0));
    wc += vec3(0.10, 0.20, 0.22) * pleat * 0.4;
    // the pale undersides of the fins catching light from below
    wc += vec3(0.20, 0.38, 0.40) * smoothstep(0.0, -0.012, d) * smoothstep(-0.10, -0.25, wq.y) * 0.35;
    // a rim of surface light along its back
    wc += vec3(0.35, 0.70, 0.72) * exp(-abs(d) * 260.0) * top * 0.6;
    // distance haze: it is far above us
    wc = mix(wc, col, 0.25);
    col = mix(col, wc, cov);
  }

  // a school of small fish wheeling in the middle distance
  vec2 sc0 = vec2(-0.48 + 0.08 * sin(t * 0.11), -0.04 + 0.04 * sin(t * 0.17));
  for (int i = 0; i < 48; i++){
    float fi = float(i);
    float a = t * (0.22 + 0.05 * hash11(fi)) + fi * 2.4;
    vec2 off = vec2(cos(a) * (0.13 + 0.07 * hash11(fi * 3.0)), sin(a * 1.3) * (0.06 + 0.04 * hash11(fi * 5.0)));
    vec2 fp = sc0 + off;
    vec2 dir = normalize(vec2(-sin(a), cos(a * 1.3) * 1.3 * 0.5));
    vec2 q = p1 - fp;
    q = vec2(dot(q, dir), dot(q, vec2(-dir.y, dir.x)));
    float fd = min(sdEllipse(q, vec2(0.0075, 0.0025)), sdTri(q, vec2(-0.005, 0.0), vec2(-0.012, 0.004), vec2(-0.012, -0.004)));
    float glint = pow(0.5 + 0.5 * sin(a * 3.0 + fi), 4.0);
    col = mix(col, vec3(0.12, 0.30, 0.36) + vec3(0.7, 0.9, 0.9) * glint * 0.6, af(fd, px) * 0.85);
  }

  // the sea floor: soft dunes of sand, painted with caustics, rocks and swaying kelp
  float floorY = -0.30 + 0.035 * fbm1lo(p2.x * 2.5 + 1.0) - 0.06 * smoothstep(-0.2, 0.7, p2.x);
  if (p2.y < floorY + px * 2.0){
    float dd = floorY - p2.y;
    float z = 0.25 / (dd + 0.04);
    vec2 g = vec2(p2.x * z, z);
    float ca = tdCaustic(g * 2.2, t);
    vec3 sand = mix(vec3(0.10, 0.22, 0.25), vec3(0.32, 0.42, 0.38), smoothstep(0.0, 0.25, dd));
    sand *= 0.85 + 0.25 * fbm4(g * vec2(3.0, 6.0));
    sand += vec3(0.60, 0.90, 0.80) * smoothstep(0.30, 0.95, ca) * 0.55 * smoothstep(0.0, 0.06, dd);
    sand = mix(sand, col, exp(-dd * 18.0) * 0.6);
    col = mix(col, sand, af(p2.y - floorY, px));
  }
  // rocks
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    vec2 rc = vec2(-0.62 + fi * 0.58, -0.36 - 0.03 * fi);
    float rd = sdEllipse(p2 - rc, vec2(0.10 - fi * 0.015, 0.05));
    rd += 0.012 * (fbm3(p2 * 30.0 + fi) - 0.5);
    rd = max(rd, -(p2.y - rc.y + 0.03));
    vec3 rcol = vec3(0.04, 0.10, 0.12) * (0.7 + 0.6 * fbm4(p2 * 40.0)) + vec3(0.3, 0.5, 0.45) * smoothstep(0.02, 0.05, p2.y - rc.y) * 0.15;
    vec2 cv = voronoi(p2 * 120.0 + fi * 3.0);
    rcol += vec3(0.55, 0.30, 0.35) * smoothstep(0.25, 0.05, cv.x) * step(0.7, cv.y) * 0.35;
    rcol += vec3(0.35, 0.55, 0.40) * smoothstep(0.25, 0.05, cv.x) * step(cv.y, 0.15) * 0.3;
    col = mix(col, rcol, af(rd, px));
  }
  // kelp: long stalks rising from the rocks, broad blades streaming with the swell
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    float bx0 = (fi < 3.0 ? -0.86 + fi * 0.13 : 0.58 + (fi - 3.0) * 0.14) + 0.04 * sin(fi * 3.1);
    float base = -0.46 - 0.04 * hash11(fi);
    float H = 0.62 + 0.30 * hash11(fi * 2.3);
    float yk = (p2.y - base) / H;
    if (yk < -0.02 || yk > 1.05) continue;
    float sway = sin(t * 0.6 + fi * 1.7 + yk * 2.2) * 0.05 * yk + 0.05 * yk * yk;
    float kx = bx0 + sway + 0.015 * sin(yk * 7.0 + fi);
    float kd = abs(p2.x - kx) - 0.0035;
    kd = max(kd, max(-yk * H, (yk - 1.0) * H));
    // blades: alternate sides, each a long leaf trailing off the stalk
    for (int b = 0; b < 7; b++){
      float fb = float(b);
      float by = (fb + 0.5) / 7.0;
      float side = mod(fb, 2.0) * 2.0 - 1.0;
      vec2 a0 = vec2(kx, base + by * H);
      float bl = 0.10 + 0.05 * hash11(fi * 9.0 + fb);
      vec2 dir = normalize(vec2(side * 0.35 + sway * 3.0, 1.0));
      vec2 lq = p2 - a0;
      float al = dot(lq, dir);
      float pr = dot(lq, vec2(-dir.y, dir.x)) - 0.008 * sin(al * 60.0 + t * 1.5 + fb);
      float w = 0.012 * sin(clamp(al / bl, 0.0, 1.0) * 3.14159) * (0.7 + 0.3 * sin(al * 90.0));
      kd = min(kd, max(abs(pr) - w, max(-al, al - bl)));
    }
    col = mix(col, mix(vec3(0.03, 0.09, 0.06), vec3(0.10, 0.22, 0.12), smoothstep(0.3, 1.0, yk)), af(kd, px) * (0.80 + 0.2 * (1.0 - yk)));
  }

  // drifting motes and the deep blue closing in at the edges
  vec2 mg = p * 60.0 + vec2(t * 0.6, -t * 0.25);
  vec2 mc = floor(mg);
  vec2 mo = hash22(mc) * 0.8 + 0.1;
  float mote = smoothstep(0.10, 0.0, length(fract(mg) - mo)) * step(0.80, hash21(mc + 5.0));
  col += vec3(0.5, 0.75, 0.75) * mote * 0.12;
  col = mix(col, vec3(0.0, 0.03, 0.07), smoothstep(0.5, 1.15, length(p * vec2(0.8, 1.0))) * 0.5);

  col = filmic(col * 1.15);
  col = grade(col, vec3(0.90, 1.0, 1.10), vec3(1.0, 1.02, 0.98), 0.4);
  return col;
}`;
