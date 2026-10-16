/* Reclaimed: a city avenue taken back by green, the low sun blazing down its length, deer among the wrecks. */

export const reclaimed = /* glsl */ `
const vec2 RC_VP = vec2(0.03, -0.035);
const float RC_W = 2.0;        // half width of the avenue, face to face
const float RC_CAM = 0.45;     // eye height
const vec2 RC_SUN = vec2(0.03, 0.035);

/* a deer standing side-on, facing left; local units, hooves at y = 0 */
float rcDeer(vec2 q, float graze){
  float body = sdEllipse(q - vec2(0.0, 0.62), vec2(0.36, 0.15));
  body = smin(body, sdCircle(q - vec2(-0.22, 0.64), 0.14), 0.06);
  body = smin(body, sdCircle(q - vec2(0.24, 0.64), 0.13), 0.06);
  vec2 n0 = vec2(-0.28, 0.70);
  vec2 hp = mix(vec2(-0.50, 1.05), vec2(-0.56, 0.22), graze);
  float neck = sdTaper(q, n0, mix(n0, hp, 0.85), 0.085, 0.055);
  vec2 hd = normalize(mix(vec2(-1.0, -0.25), vec2(-0.3, -1.0), graze));
  float head = sdTaper(q, hp, hp + hd * 0.17, 0.055, 0.025);
  float ears = sdTri(q, hp + vec2(0.02, 0.02), hp + vec2(0.10, 0.10), hp + vec2(0.05, 0.0));
  vec2 a0 = hp + vec2(0.02, 0.04);
  vec2 up = normalize(mix(vec2(0.3, 1.0), vec2(1.0, 0.5), graze));
  float ant = sdTaper(q, a0, a0 + up * 0.28, 0.010, 0.004);
  ant = min(ant, sdTaper(q, a0 + up * 0.10, a0 + up * 0.10 + rot2(0.7) * up * 0.12, 0.007, 0.002));
  ant = min(ant, sdTaper(q, a0 + up * 0.18, a0 + up * 0.18 + rot2(-0.6) * up * 0.12, 0.006, 0.002));
  ant = min(ant, sdTaper(q, a0 + up * 0.24, a0 + up * 0.24 + rot2(0.8) * up * 0.09, 0.005, 0.002));
  float d = smin(body, neck, 0.05);
  d = smin(d, head, 0.03);
  d = min(d, min(ears, ant));
  d = min(d, sdTaper(q, vec2(-0.22, 0.55), vec2(-0.24, 0.0), 0.040, 0.018));
  d = min(d, sdTaper(q, vec2(-0.14, 0.55), vec2(-0.12, 0.0), 0.036, 0.016));
  d = min(d, sdTaper(q, vec2(0.22, 0.58), vec2(0.27, 0.30), 0.055, 0.025));
  d = min(d, sdTaper(q, vec2(0.27, 0.30), vec2(0.24, 0.0), 0.025, 0.016));
  d = min(d, sdTaper(q, vec2(0.30, 0.58), vec2(0.36, 0.30), 0.050, 0.024));
  d = min(d, sdTaper(q, vec2(0.36, 0.30), vec2(0.34, 0.0), 0.024, 0.016));
  d = min(d, sdTri(q, vec2(0.34, 0.70), vec2(0.42, 0.66), vec2(0.36, 0.62)));
  return d;
}

/* the haze colour at a given distance along the avenue: the farther, the more it glows */
vec3 rcHaze(vec2 p){
  float r = length((p - RC_SUN) * vec2(0.8, 1.0));
  return mix(vec3(0.95, 0.72, 0.42), vec3(1.0, 0.92, 0.70), exp(-r * 6.0));
}

/* one row of buildings, silhouetted against the light: colour and coverage */
vec4 rcRow(vec2 p, float side, float px, float t){
  float dx = (p.x - RC_VP.x) * side;
  if (dx <= 0.0) return vec4(0.0);
  float z = RC_W / dx;
  float Y = RC_CAM + (p.y - RC_VP.y) * z;
  float blockLen = 3.2;
  float bi = floor(z / blockLen);
  float H = 3.0 + 8.0 * hash11(bi * 7.3 + side * 3.0);
  float u = z - bi * blockLen;
  // crumbled tops and stepped setbacks
  float crumble = step(0.65, hash11(bi * 1.9 + side)) * 1.2 * n1(u * 3.0 + side * 9.0 + bi);
  float setback = step(0.5, hash11(bi * 4.4 + side)) * step(u, blockLen * 0.35) * H * 0.25;
  float topY = H - crumble - setback;
  // rooftop trees and water tanks breaking the skyline
  float roofTree = step(0.55, hash11(bi * 8.1 + side)) * 0.9 * smoothstep(0.0, 0.4, 0.6 - abs(u - 1.6) / 1.2) * (0.7 + 0.3 * n1(u * 9.0 + bi));
  float tank = step(0.75, hash11(bi * 2.7 + side)) * step(abs(u - 0.7), 0.25) * 0.8;
  float sky = max(topY + roofTree, topY + tank);
  if (Y > sky || Y < 0.0) return vec4(0.0);
  float edge = (sky - Y) / z;                         // screen distance to the skyline, for a rim of light
  // window grid, dark, a few catching the glare
  vec2 wq = vec2(u / 0.30, Y / 0.34);
  vec2 wc = floor(wq);
  vec2 wl = fract(wq);
  float win = step(0.18, wl.x) * step(wl.x, 0.82) * step(0.22, wl.y) * step(wl.y, 0.82) * step(0.30, Y) * step(0.15, u) * step(u, blockLen - 0.15) * step(Y, topY - 0.15);
  vec3 wall = vec3(0.075, 0.068, 0.068) * (0.8 + 0.4 * fbm4(vec2(u * 2.0, Y * 1.5) + bi));
  vec3 c = mix(wall, vec3(0.03, 0.03, 0.035) + vec3(1.0, 0.8, 0.5) * 0.35 * step(0.93, hash21(wc + bi * 13.0)), win);
  // ivy over the lower floors, vines hanging off the ledges
  float ivy = smoothstep(0.45, 0.70, fbm4(vec2(u * 1.4, Y * 1.1) + bi * 3.0) * 0.7 + fbm4(vec2(u * 7.0, Y * 6.0)) * 0.3 + 0.28 - Y * 0.08);
  float hang = smoothstep(0.70, 0.92, n1(u * 12.0 + bi * 7.0)) * smoothstep(topY, topY - 2.5 * hash11(bi + side), Y) * step(0.35, hash11(bi * 5.0 + side));
  vec3 green = mix(vec3(0.025, 0.045, 0.015), vec3(0.07, 0.10, 0.03), fbm4(vec2(u * 8.0, Y * 6.0)));
  c = mix(c, green, clamp(max(ivy, hang), 0.0, 1.0));
  if (Y > topY) c = mix(vec3(0.05, 0.08, 0.03), vec3(0.06, 0.06, 0.06), step(0.5, tank));
  // gaps between blocks let the light through
  float gap = smoothstep(0.08, 0.0, u) + smoothstep(blockLen - 0.08, blockLen, u);
  c = mix(c, rcHaze(p) * 0.6, gap * 0.6);
  // a rim of sunlight along the skyline and the block edges
  c += vec3(1.0, 0.72, 0.38) * (exp(-edge / (px * 2.5)) * 0.9 + exp(-min(u, blockLen - u) * z / 0.02) * 0.0);
  // aerial perspective: distant blocks dissolve into the glow
  c = mix(c, rcHaze(p), smoothstep(5.0, 40.0, z) * 0.92);
  return vec4(c, 1.0);
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0) + m * vec2(0.012, 0.006);
  float t = uTime;

  // the sky: molten around the low sun, cooling upward
  float h = p.y - RC_VP.y;
  float rs = length(p - RC_SUN);
  vec3 col = mix(vec3(1.0, 0.78, 0.48), vec3(0.38, 0.52, 0.66), smoothstep(0.0, 0.55, h));
  col += vec3(1.0, 0.80, 0.50) * exp(-rs * 4.0) * 0.8 + vec3(1.0, 0.95, 0.80) * exp(-rs * 18.0) * 1.2;
  col = mix(col, vec3(1.0, 0.97, 0.88) * 3.0, af(rs - 0.030, px));

  // the avenue: dark asphalt cracked by grass, water standing in the dips holding the sun
  if (p.y < RC_VP.y){
    float zg = RC_CAM / (RC_VP.y - p.y);
    float xg = (p.x - RC_VP.x) * zg;
    vec2 g = vec2(xg, zg);
    vec3 tar = vec3(0.10, 0.09, 0.085) * (0.8 + 0.3 * fbm4(g * vec2(2.0, 1.0)));
    float crack = smoothstep(0.04, 0.0, abs(fbm4(g * 0.8) - 0.5));
    float grass = smoothstep(0.45, 0.62, fbm4(g * vec2(0.6, 0.35) + 7.0) + crack * 0.4 + smoothstep(1.2, 2.0, abs(xg)) * 0.5);
    vec3 gc = mix(tar, vec3(0.06, 0.09, 0.03), grass);
    // the low sun glazing the road toward us
    float glare = exp(-abs(xg + (p.x - RC_VP.x) * 0.0) * 0.9) * exp(-zg * 0.0);
    float pud = smoothstep(0.62, 0.66, fbm4(g * vec2(1.6, 0.9) + 3.0)) * (1.0 - grass) * smoothstep(0.5, 3.0, zg);
    vec3 refl = mix(vec3(0.95, 0.70, 0.40), vec3(1.0, 0.92, 0.70), exp(-abs(p.x - RC_SUN.x) * 8.0));
    gc = mix(gc, refl * (0.5 + 0.5 * exp(-abs(p.x - RC_SUN.x) * 4.0)), pud * 0.85);
    gc += vec3(1.0, 0.75, 0.40) * exp(-abs(p.x - RC_SUN.x) * 6.0) * exp(-(RC_VP.y - p.y) * 6.0) * 0.25 * (1.0 - grass * 0.6);
    gc = mix(gc, vec3(0.62, 0.62, 0.40) * 0.5, step(abs(xg), 0.03) * step(0.5, fract(zg * 0.5)) * (1.0 - grass) * 0.5);
    gc = mix(gc, rcHaze(p), smoothstep(6.0, 40.0, zg) * 0.9);
    col = gc;
  }
  // the two rows of towers
  vec4 L = rcRow(p, -1.0, px, t);
  vec4 R = rcRow(p, 1.0, px, t);
  if (L.a > 0.0) col = L.rgb;
  if (R.a > 0.0) col = R.rgb;

  // god rays fanning out from the sun down the avenue
  vec2 dv = p - RC_SUN;
  float ang = atan(dv.y, dv.x);
  float rays = pow(n1(ang * 11.0 + t * 0.02), 2.5) * 0.8 + pow(n1(ang * 29.0 - t * 0.015), 3.0) * 0.5;
  col += vec3(1.0, 0.80, 0.48) * rays * exp(-rs * 2.2) * 0.35 * (0.25 + 0.75 * exp(-abs(p.x - RC_SUN.x) * 3.0));

  // trees grown up through the road, backlit, leaves glowing at their edges
  for (int i = 0; i < 5; i++){
    float fi = float(i);
    float z = 1.9 + fi * 2.3;
    float xg = mod(fi, 2.0) < 1.0 ? -1.25 - 0.2 * hash11(fi) : 1.20 + 0.25 * hash11(fi);
    vec2 base = vec2(RC_VP.x + xg / z, RC_VP.y - RC_CAM / z);
    float H = 2.6 / z;
    float trunk = sdTaper(p, base, base + vec2(0.02 / z, H * 0.6), 0.040 / z, 0.018 / z);
    vec2 cc = base + vec2(0.0, H * 0.78);
    vec2 cq = (p - cc) / (H * 0.42);
    float leafy = fbm4(cq * 3.0 + fi * 5.0);
    float crown = length(cq * vec2(0.85, 1.0)) - 0.78 - (leafy - 0.5) * 0.6;
    float cd = crown * H * 0.42;
    float d = min(trunk, cd);
    if (d < px * 2.0){
      vec3 tc = vec3(0.03, 0.045, 0.02) * (0.8 + 0.4 * leafy);
      // sun glinting through the leaves near the crown's edge
      float glint = smoothstep(0.55, 0.80, vnoise(cq * 14.0 + fi)) * smoothstep(-0.25, 0.0, crown) * step(cd, trunk);
      tc += vec3(1.0, 0.80, 0.40) * (exp(-abs(cd) / (px * 1.5)) * 0.5 * step(cd, trunk) + glint * 0.35);
      tc = mix(tc, rcHaze(p), smoothstep(7.0, 40.0, z) * 0.8);
      col = mix(col, tc, af(d, px));
    }
  }

  // a rusted car left at the curb, ivy over its roof
  {
    float z = 2.2;
    vec2 base = vec2(RC_VP.x - 1.0 / z, RC_VP.y - RC_CAM / z);
    float sc = 1.0 / z;
    vec2 q = (p - base) / sc;
    float body = sdBox(q - vec2(0.0, 0.22), vec2(0.40, 0.13)) - 0.04;
    float cab = sdBox(q - vec2(0.0, 0.45), vec2(0.30, 0.09)) - 0.05;
    float car = max(min(body, cab), -q.y + 0.04);
    car = min(car, min(sdBox(q - vec2(-0.30, 0.07), vec2(0.07, 0.07)), sdBox(q - vec2(0.30, 0.07), vec2(0.07, 0.07))));
    vec3 cc = vec3(0.07, 0.05, 0.04) * (0.8 + 0.4 * fbm4(q * 8.0));
    cc = mix(cc, vec3(0.30, 0.20, 0.12), smoothstep(0.004, -0.004, sdBox(q - vec2(0.0, 0.46), vec2(0.25, 0.06))) * 0.6);
    cc = mix(cc, vec3(0.05, 0.08, 0.03), smoothstep(0.55, 0.75, fbm4(q * 5.0) + 0.35 - q.y * 0.6));
    cc += vec3(1.0, 0.75, 0.40) * exp(-abs(car) * sc / (px * 2.5)) * 0.5 * step(0.3, q.y);
    col = mix(col, cc, af(car * sc, px));
  }

  // deer in the avenue, rimmed with gold: one grazing, one watching
  for (int i = 0; i < 2; i++){
    float fi = float(i);
    float z = 2.6 + fi * 1.5;
    float xg = 0.30 - fi * 0.85;
    vec2 base = vec2(RC_VP.x + xg / z, RC_VP.y - RC_CAM / z);
    float sc = 0.60 / z;
    vec2 q = (p - base) / sc;
    if (fi > 0.5) q.x = -q.x;
    float graze = fi < 0.5 ? smoothstep(0.2, 0.6, sin(t * 0.22) * 0.5 + 0.5) : 0.15 * smoothstep(0.7, 1.0, sin(t * 0.31));
    if (abs(q.x) < 0.8 && q.y > -0.05 && q.y < 1.5){
      float d = rcDeer(q, graze);
      vec3 dc = vec3(0.07, 0.05, 0.04) + vec3(1.0, 0.75, 0.40) * exp(-abs(d) * sc / (px * 1.0)) * 0.55 * smoothstep(0.2, 0.9, q.y);
      col = mix(col, dc, af(d * sc, px));
    }
  }

  // birds wheeling in the light
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    vec2 c = RC_SUN + vec2(0.12 * cos(t * 0.12 + fi * 1.6), 0.16 + 0.05 * sin(t * 0.17 + fi * 1.3));
    vec2 q = p - c;
    float flap = sin(t * 6.0 + fi * 2.0) * 0.5 + 0.4;
    float w = min(sdSeg(q, vec2(0.0), vec2(-0.010, 0.006 * flap)), sdSeg(q, vec2(0.0), vec2(0.010, 0.006 * flap)));
    col = mix(col, vec3(0.12, 0.10, 0.10), af(w - 0.0012, px) * 0.8);
  }
  // pollen drifting through the beams
  vec2 mg = p * 45.0 + vec2(t * 0.4, sin(t * 0.3) * 0.5);
  vec2 mc = floor(mg);
  float mote = smoothstep(0.12, 0.0, length(fract(mg) - hash22(mc) * 0.8 - 0.1)) * step(0.85, hash21(mc + 3.0));
  col += vec3(1.0, 0.9, 0.6) * mote * 0.30 * exp(-rs * 1.5);

  col = filmic(col * 1.0);
  col = grade(col, vec3(0.88, 0.98, 1.10), vec3(1.06, 1.0, 0.90), 0.5);
  return col;
}`;
