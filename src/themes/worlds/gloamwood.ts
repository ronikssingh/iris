/* Gloamwood: an abandoned car on a fog-drowned country road, one headlight still burning, crows in the dead trees. */

export const gloamwood = /* glsl */ `
const vec2 GW_VP = vec2(0.06, -0.035);
const vec3 GW_FOG = vec3(0.40, 0.45, 0.44);

/* a bare, dead tree: crooked trunk, limbs reaching at odd angles, forks and twigs. base at origin, height about 1 */
float gwTree(vec2 q, float seed, float detail){
  float lean = (hash11(seed) - 0.5) * 0.16;
  float broken = step(0.86, hash11(seed * 1.9));
  float H = 1.0 - broken * 0.42;
  vec2 b1 = vec2(lean * 0.4 + 0.025 * sin(seed * 3.0), 0.5 * H);
  vec2 b2 = vec2(lean, H);
  float d = min(sdTaper(q, vec2(0.0, -0.06), b1, 0.042, 0.027), sdTaper(q, b1, b2, 0.027, 0.006 + broken * 0.02));
  if (q.y < 0.25 || abs(q.x) > 0.85) return d;
  int n = broken > 0.5 ? 3 : 6;
  for (int i = 0; i < 6; i++){
    if (i >= n) break;
    float fi = float(i);
    float r1 = hash11(seed * 3.1 + fi * 1.7), r2 = hash11(seed * 5.3 + fi * 2.9), r3 = hash11(seed * 7.7 + fi * 4.3);
    float h = (0.34 + 0.58 * fi / 5.0 + 0.05 * r1) * H;
    vec2 a = h < 0.5 * H ? mix(vec2(0.0), b1, h / (0.5 * H)) : mix(b1, b2, (h - 0.5 * H) / (0.5 * H));
    float side = r2 > 0.5 ? 1.0 : -1.0;
    float ang = (0.35 + 0.75 * r3) * side;
    float len = (0.56 - 0.30 * fi / 5.0) * (0.6 + 0.55 * r1);
    vec2 dir = vec2(sin(ang), cos(ang));
    vec2 kink = vec2(-dir.y, dir.x) * len * (r2 - 0.5) * 0.25;
    vec2 mid = a + dir * len * 0.5 + kink;
    vec2 end = a + rot2(-side * 0.25 * r3) * dir * len;
    float w0 = 0.019 - fi * 0.002;
    d = min(d, min(sdTaper(q, a, mid, w0, w0 * 0.6), sdTaper(q, mid, end, w0 * 0.6, 0.0025)));
    if (detail > 0.5){
      vec2 f1 = mid + rot2(side * 0.7) * dir * len * 0.40;
      vec2 f2 = end + rot2(-side * 0.5) * dir * len * 0.28;
      vec2 f3 = mix(mid, end, 0.6) + rot2(side * 0.9) * dir * len * 0.22;
      d = min(d, min(sdTaper(q, mid, f1, w0 * 0.45, 0.0015), min(sdTaper(q, end, f2, 0.003, 0.0012), sdTaper(q, mix(mid, end, 0.6), f3, 0.003, 0.0012))));
    }
  }
  return d;
}

/* an old sedan, nose to the right: x = body, y = windows, z = headlight lens */
vec3 gwCar(vec2 q){
  float body = sdBox(q - vec2(0.0, 0.050), vec2(0.205, 0.024)) - 0.008;
  body = min(body, sdBox(q - vec2(0.140, 0.074), vec2(0.07, 0.004)) - 0.004);         // hood
  body = min(body, sdBox(q - vec2(-0.165, 0.077), vec2(0.045, 0.004)) - 0.004);       // trunk lid
  // the greenhouse
  float cab = sdTri(q, vec2(-0.13, 0.080), vec2(0.075, 0.080), vec2(0.010, 0.128));
  cab = min(cab, sdTri(q, vec2(-0.13, 0.080), vec2(0.010, 0.128), vec2(-0.095, 0.128)));
  cab = min(cab, sdBox(q - vec2(-0.040, 0.126), vec2(0.055, 0.004)) - 0.002);
  float d = min(body, cab);
  // windows: the cabin inset, split by pillars
  float wins = sdTri(q, vec2(-0.118, 0.085), vec2(0.064, 0.085), vec2(0.008, 0.122));
  wins = min(wins, sdTri(q, vec2(-0.118, 0.085), vec2(0.008, 0.122), vec2(-0.090, 0.122)));
  wins = max(wins, -max(abs(q.x + 0.030) - 0.005, abs(q.y - 0.1) - 0.05));
  // wheel wells and tyres
  d = max(d, -sdCircle(q - vec2(0.130, 0.026), 0.034));
  d = max(d, -sdCircle(q - vec2(-0.135, 0.026), 0.034));
  d = min(d, sdCircle(q - vec2(0.130, 0.026), 0.027));
  d = min(d, sdEllipse(q - vec2(-0.135, 0.021), vec2(0.029, 0.022)));
  // bumpers
  d = min(d, sdBox(q - vec2(0.215, 0.040), vec2(0.006, 0.006)) - 0.002);
  d = min(d, sdBox(q - vec2(-0.215, 0.042), vec2(0.006, 0.006)) - 0.002);
  float lens = sdEllipse(q - vec2(0.207, 0.061), vec2(0.005, 0.008));
  return vec3(d, wins, lens);
}

/* a crow; local units of about one body length */
float gwCrow(vec2 q, float fly, float flap, float tilt){
  float b = sdEllipse(q - vec2(0.0, 0.9), vec2(0.9, 0.5));
  b = min(b, sdCircle(q - vec2(0.78 - tilt * 0.3, 1.40 + tilt * 0.2), 0.36));
  b = min(b, sdTri(q, vec2(1.0, 1.47 + tilt * 0.2), vec2(1.62, 1.36 + tilt * 0.1), vec2(1.0, 1.30)));
  b = min(b, sdTri(q, vec2(-0.6, 0.88), vec2(-1.75, 0.45), vec2(-1.55, 0.78)));
  if (fly > 0.01){
    b = min(b, min(sdTri(q, vec2(-0.3, 1.0), vec2(0.5, 1.0), vec2(-0.5, 1.0 + 2.4 * flap)), sdTri(q, vec2(-0.3, 1.0), vec2(0.5, 1.0), vec2(0.1, 1.0 - 1.6 * flap))));
  } else {
    b = min(b, max(abs(q.x) - 0.06, max(q.y - 0.45, -q.y)));
  }
  return b;
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 p0 = p + m * vec2(0.004, 0.003);
  vec2 p2 = p + m * vec2(0.016, 0.007);
  vec2 p3 = p + m * vec2(0.030, 0.011);

  // the headlight flickers, and now and then gutters out
  float flick = 0.86 + 0.14 * sin(t * 13.0) * sin(t * 7.3);
  flick *= 1.0 - 0.85 * smoothstep(0.93, 0.97, sin(t * 0.23) * 0.5 + 0.5 + 0.03 * sin(t * 31.0));

  // overcast sky, a pale sun drowned in mist
  float h = p0.y - GW_VP.y;
  vec3 col = mix(vec3(0.54, 0.58, 0.56), vec3(0.20, 0.23, 0.25), smoothstep(0.0, 0.55, h));
  float sd = length(p0 - vec2(-0.32, 0.22));
  col += vec3(0.80, 0.78, 0.62) * (exp(-sd * 5.0) * 0.30 + exp(-sd * 28.0) * 0.35);
  col = mix(col, vec3(0.27, 0.30, 0.31), smoothstep(0.45, 0.80, fbm4(vec2(p0.x * 1.4 + t * 0.006, p0.y * 3.0))) * smoothstep(0.05, 0.3, h) * 0.55);

  // the road in perspective, and the woods on either side, row by row from far to near
  float dy = GW_VP.y - p2.y;
  if (dy > 0.0){
    float z = 0.5 / (dy + 0.002);
    float rx = (p2.x - GW_VP.x) * z;
    float bend = 0.10 * sin(z * 0.12);
    float rr = rx - bend;
    float road = 1.0 - smoothstep(0.52, 0.58, abs(rr));
    vec3 verge = mix(vec3(0.13, 0.14, 0.12), vec3(0.21, 0.22, 0.18), fbm4(vec2(rx * 2.0, z * 1.5)));
    float crack = smoothstep(0.03, 0.0, abs(fbm4(vec2(rr * 5.0, z * 3.0)) - 0.5)) * 0.4;
    vec3 tar = vec3(0.16, 0.165, 0.165) * (0.85 + 0.25 * fbm4(vec2(rr * 8.0, z * 6.0))) * (1.0 - crack);
    // a faded double yellow line, worn through in places
    float line = (1.0 - smoothstep(0.004, 0.009, abs(abs(rr) - 0.016))) * smoothstep(0.35, 0.55, fbm4(vec2(z * 2.0, 3.0)));
    tar = mix(tar, vec3(0.55, 0.48, 0.22), line * 0.6);
    // rain water standing in the dips, holding the pale sky
    float pud = smoothstep(0.64, 0.68, fbm4(vec2(rr * 3.5 + 3.0, z * 2.2)));
    tar = mix(tar, vec3(0.34, 0.37, 0.37) * (0.92 + 0.08 * sin(z * 40.0 + t * 1.5)), pud * road * 0.7);
    vec3 gc = mix(verge, tar, road);
    gc = mix(gc, GW_FOG, smoothstep(1.5, 14.0, z) * 0.92);
    col = mix(col, gc, smoothstep(0.0, 0.004, dy));
  }
  // rows of dead trees standing back from the road, each fainter in the fog
  for (int r = 0; r < 5; r++){
    float fr = float(r);
    float z = 9.0 / (1.0 + fr * 0.85);
    vec2 q = p2 + m * vec2(0.010, 0.004) * (fr * 0.2 - 0.6);
    float ground = GW_VP.y - 0.5 / z;
    float rx = (q.x - GW_VP.x) * z;
    float cell = 0.45 + 0.1 * fr;
    float c = floor(rx / cell);
    float d = 1e5;
    for (int k = -1; k <= 1; k++){
      float id = c + float(k);
      float tx = (id + 0.5 + 0.6 * (hash11(id * 3.1 + fr * 7.0) - 0.5)) * cell;
      if (abs(tx) < 0.95 + 0.4 * hash11(id + fr)) continue;
      float th = (1.6 + 1.1 * hash11(id * 5.7 + fr)) / z;
      vec2 tq = (q - vec2(GW_VP.x + tx / z, ground)) / th;
      if (tq.y > -0.1 && tq.y < 1.15 && abs(tq.x) < 0.85) d = min(d, gwTree(tq, id * 1.31 + fr * 13.0, fr > 2.5 ? 1.0 : 0.0) * th);
    }
    d = max(d, ground - 0.003 - q.y);
    float fogAmt = clamp(0.92 - fr * 0.20, 0.0, 1.0);
    col = mix(col, mix(vec3(0.06, 0.065, 0.065), GW_FOG, fogAmt), af(d, px));
    // a bank of fog lying at the foot of the row
    float fb = exp(-abs(q.y - ground - 0.012 / (1.0 + fr * 0.3)) * (24.0 + fr * 6.0)) * smoothstep(0.35, 0.8, fbm4(vec2(q.x * (2.0 + fr) - t * 0.01 * (fr + 1.0), q.y * 10.0 + fr)));
    col = mix(col, GW_FOG * 1.06, fb * 0.55);
  }

  // telephone poles leaning along the right shoulder, wires sagging between
  float wires = 1e5;
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    float z = 1.25 + fi * 1.2;
    float z2 = z + 1.2;
    vec2 base = vec2(GW_VP.x + 0.88 / z, GW_VP.y - 0.5 / z);
    vec2 top = base + vec2(0.05 * sin(fi * 2.0 + 1.0), 0.95) / z;
    vec2 base2 = vec2(GW_VP.x + 0.88 / z2, GW_VP.y - 0.5 / z2);
    vec2 top2 = base2 + vec2(0.05 * sin(fi * 2.0 + 3.2), 0.95) / z2;
    float pole = sdTaper(p2, base, top, 0.014 / z, 0.010 / z);
    pole = min(pole, sdSeg(p2, top + vec2(-0.10, -0.06) / z, top + vec2(0.10, -0.055) / z) - 0.006 / z);
    float fogAmt = smoothstep(1.0, 6.0, z) * 0.85;
    col = mix(col, mix(vec3(0.07, 0.07, 0.07), GW_FOG, fogAmt), af(pole, px));
    for (int w = -1; w <= 1; w += 2){
      vec2 a = top + vec2(float(w) * 0.08, -0.06) / z;
      vec2 b = top2 + vec2(float(w) * 0.08, -0.06) / z2;
      if ((p2.x - a.x) * (p2.x - b.x) <= 0.0){
        float u = clamp((p2.x - a.x) / (b.x - a.x), 0.0, 1.0);
        float wy = mix(a.y, b.y, u) - 0.12 / z * u * (1.0 - u);
        wires = min(wires, abs(p2.y - wy) - 0.0006);
      }
    }
  }
  col = mix(col, vec3(0.09, 0.09, 0.09), af(wires, px) * 0.75);
  // crows along the first span of wire, one taking off now and then
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    float u = 0.25 + fi * 0.16;
    float z = 1.25, z2 = 2.45;
    vec2 a = vec2(GW_VP.x + 0.88 / z, GW_VP.y - 0.5 / z) + vec2(0.05 * sin(1.0) - 0.08, 0.95 - 0.06) / z;
    vec2 b = vec2(GW_VP.x + 0.88 / z2, GW_VP.y - 0.5 / z2) + vec2(0.05 * sin(3.2) - 0.08, 0.95 - 0.06) / z2;
    vec2 c = mix(a, b, u) - vec2(0.0, 0.12 / z * u * (1.0 - u));
    float cyc = mod(t + fi * 9.3, 41.0);
    float fly = smoothstep(33.0, 33.6, cyc);
    c += fly * (cyc - 33.0) * vec2(-0.09, 0.05);
    float scC = 0.0085 * mix(1.0, 0.75, u);
    vec2 q = (p2 - c) / scC;
    if (abs(q.x) < 3.0 && q.y > -1.0 && q.y < 4.0) col = mix(col, vec3(0.05, 0.05, 0.055), af(gwCrow(q, fly, sin(t * 18.0 + fi), 0.0) * scC, px));
  }

  // the abandoned car slewed across the left shoulder, one headlight still alive
  float zc = 2.1;
  vec2 carO = vec2(GW_VP.x - 0.90 / zc, GW_VP.y - 0.5 / zc);
  float csc = 0.80;
  vec2 cq = rot2(0.035) * (p2 - carO) / csc;
  vec2 lampW = carO + rot2(-0.035) * vec2(0.207, 0.061) * csc;
  // the beam: a cone of light pushing into the mist across the road
  vec2 bd = normalize(vec2(1.0, -0.10));
  vec2 lq = p2 - lampW;
  float along = dot(lq, bd);
  float perp = abs(dot(lq, vec2(-bd.y, bd.x)));
  float cone = smoothstep(0.015 + along * 0.26, along * 0.05, perp) * step(0.0, along);
  float mist = 0.55 + 0.45 * fbm4(vec2(along * 6.0 - t * 0.15, perp * 14.0 + t * 0.05));
  col += vec3(1.0, 0.86, 0.60) * cone * exp(-along * 1.6) * mist * 0.75 * flick;
  if (dy > 0.0){
    float pool = exp(-length((p2 - (lampW + bd * 0.32 + vec2(0.0, -0.045))) * vec2(0.9, 4.0)) * 5.0);
    col += vec3(1.0, 0.84, 0.58) * pool * 0.35 * flick;
  }
  // a shadow pooled under it
  col *= 1.0 - 0.45 * exp(-length((p2 - carO - vec2(0.0, 0.004)) * vec2(1.0 / (0.22 * csc), 1.0 / 0.012)) * 1.5) * step(p2.y, carO.y + 0.01);
  if (abs(cq.x) < 0.25 && cq.y > -0.01 && cq.y < 0.15){
    vec3 cr = gwCar(cq);
    float cov = af(cr.x, px / csc);
    float rust = smoothstep(0.55, 0.75, fbm4(cq * 26.0));
    vec3 cc = mix(vec3(0.075, 0.08, 0.08), vec3(0.16, 0.09, 0.05), rust * 0.6);
    cc *= 0.8 + 0.4 * smoothstep(0.02, 0.09, cq.y);
    cc += vec3(0.55, 0.58, 0.56) * exp(-abs(cr.x) * 900.0) * 0.12;
    // grimy glass reflecting the grey sky; a dome light left on inside
    float wcov = af(cr.y, px / csc);
    vec3 glass = vec3(0.22, 0.25, 0.25) * (0.7 + 0.5 * smoothstep(0.08, 0.125, cq.y)) + vec3(0.55, 0.45, 0.28) * 0.18 * flick * exp(-length(cq - vec2(-0.03, 0.11)) * 28.0);
    cc = mix(cc, glass, wcov);
    col = mix(col, cc, cov);
    col += vec3(1.0, 0.94, 0.80) * af(cr.z, px / csc) * 2.2 * flick;
  }
  col += vec3(1.0, 0.88, 0.62) * (exp(-length(p2 - lampW) * 260.0) * 1.3 + exp(-length(p2 - lampW) * 30.0) * 0.12) * flick;

  // a big dead tree close on the left, a crow keeping watch
  vec2 fq = (p3 - vec2(-0.70, -0.56)) / 1.05;
  if (fq.x > -0.7 && fq.x < 0.8 && fq.y > -0.06){
    float d = gwTree(fq, 41.0, 1.0) * 1.05;
    col = mix(col, vec3(0.035, 0.038, 0.040), af(d, px));
  }
  {
    vec2 c = vec2(-0.555, 0.195) + m * vec2(0.030, 0.011);
    float tilt = smoothstep(0.6, 1.0, sin(t * 0.5));
    vec2 q = (p - c) / 0.014;
    col = mix(col, vec3(0.03, 0.03, 0.035), af(gwCrow(q, 0.0, 0.0, tilt) * 0.014, px));
  }

  // tall grass along the bottom edge
  {
    float ground = -0.50 + 0.07 * smoothstep(0.25, 0.9, abs(p3.x - 0.05));
    float cell = 0.007;
    float cg = floor(p3.x / cell);
    float g = 1e5;
    for (int k = -1; k <= 1; k++){
      float id = cg + float(k);
      float hx = (id + hash11(id * 1.3)) * cell;
      float gh = 0.025 + 0.075 * hash11(id * 3.1) * smoothstep(0.15, 0.6, abs(hx - 0.05));
      float yy = (p3.y - ground) / gh;
      if (yy < 0.0 || yy > 1.0) continue;
      float bnd = (hash11(id * 7.0) - 0.5) * 0.7 + 0.15 * sin(t * 0.9 + hx * 8.0);
      g = min(g, abs(p3.x - hx - bnd * gh * yy * yy) - cell * 0.2 * (1.0 - yy));
    }
    col = mix(col, vec3(0.05, 0.055, 0.05), af(min(g, p3.y - ground), px));
  }

  // low fog creeping over everything
  float lf = smoothstep(0.42, 0.85, fbm4(vec2(p.x * 1.6 + t * 0.018, p.y * 4.0 - t * 0.006)));
  col = mix(col, GW_FOG * 1.08, lf * 0.28 * smoothstep(0.1, -0.35, p.y));
  col = mix(col, GW_FOG, 0.08);

  col = filmic(col * 1.2);
  col = grade(col, vec3(0.92, 1.02, 1.04), vec3(1.04, 1.02, 0.94), 0.5);
  col = saturate3(col, 0.80);
  return col;
}`;
