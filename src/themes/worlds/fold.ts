/* Fold: a boulevard of cream stone, iron balconies and zinc roofs that bends up ahead of us,
   climbs into a sheer wall and curls overhead, its far end hanging upside down in the sky. */

export const fold = /* glsl */ `
const float FD_E = 1.7;          // eye height
const float FD_R = 72.0;         // radius of the fold
const float FD_W = 19.0;         // half-width of the boulevard, facade to facade
const float FD_H = 21.0;         // cornice and roof height
const float FD_X = 52.0;         // the city's half-width: beyond it, sky
const float FD_SEND = 420.0;     // where the folded city ends, far overhead behind us

float fdZ0(float t){ return 78.0 + 5.0 * sin(t * 0.05); }

/* unfold a point: x across, s along the street's surface, h above it (toward the fold's axis) */
vec3 fdUnfold(vec3 P, float z0){
  float yc = FD_R - FD_E;
  if (P.z < z0){
    if (P.y < yc) return vec3(P.x, P.z, P.y + FD_E);
    return vec3(P.x, z0 + 3.14159265 * FD_R + (z0 - P.z), yc + FD_R - P.y);
  }
  vec2 q = vec2(P.z - z0, yc - P.y);
  float th = atan(q.x, q.y);
  if (th < 0.0) th += 6.2831853;
  return vec3(P.x, z0 + FD_R * th, FD_R - length(q));
}

/* the city in unfolded space: ground, building blocks between cross streets, plane trees, parked cars, chimneys */
float fdMap(vec3 u, out float id){
  float ax = abs(u.x);
  float d = u.z;                                           // the street surface
  id = 0.0;
  float block = mod(u.y, 80.0);
  float cross = step(block, 15.0);                         // a cross street every 80 m
  float db = max(FD_W - ax, u.z - FD_H);                   // the buildings
  db = max(db, ax - FD_X);
  db = mix(db, max(db, 15.0 - block), cross);
  if (db < d){ d = db; id = 1.0; }
  // chimney stacks scattered along the rooftops
  vec2 cg = vec2(floor((ax - FD_W) / 9.0), floor(u.y / 11.0));
  vec2 ch = hash22(cg + 7.0);
  vec3 cq = vec3(mod(ax - FD_W, 9.0) - 2.0 - 5.0 * ch.x, mod(u.y, 11.0) - 2.0 - 7.0 * ch.y, u.z - FD_H - 1.0);
  float chim = max(max(abs(cq.x) - 0.6, abs(cq.y) - 1.4), abs(cq.z) - 1.1);
  chim = max(chim, FD_W + 1.0 - ax);
  chim = (cross > 0.5 || hash21(cg) < 0.35) ? 1e5 : chim;
  if (chim < d){ d = chim; id = 1.6; }
  // plane trees along the pavements
  float ts = mod(u.y + 4.0, 10.0) - 5.0;
  vec3 tq = vec3(ax - (FD_W - 3.2), ts, u.z);
  float trunk = max(length(tq.xy) - 0.28, u.z - 5.0);
  vec3 cq2 = tq - vec3(0.0, 0.0, 6.6);
  float crown = length(cq2 * vec3(1.0, 1.0, 1.25)) - 2.5 + 0.30 * sin(cq2.x * 3.1 + 1.0) * sin(cq2.y * 2.7) * sin(cq2.z * 3.3 + 2.0);
  if (cross < 0.5){
    if (trunk < d){ d = trunk; id = 2.0; }
    if (crown * 0.8 < d){ d = crown * 0.8; id = 3.0; }
  }
  // cars parked along both kerbs
  float cs = mod(u.y + 1.5, 6.4) - 3.2;
  float cid = floor((u.y + 1.5) / 6.4) + step(0.0, u.x) * 53.0;
  if (hash11(cid * 1.7) > 0.30 && cross < 0.5 && u.y > 48.0){
    vec3 kq = vec3(ax - (FD_W - 7.0), cs, u.z - 0.75);
    float car = sdBox(kq.xy, vec2(0.85, 2.05)) - 0.12;
    car = max(car, abs(kq.z) - 0.62);
    vec3 cab = kq - vec3(0.0, -0.2, 0.75);
    car = min(car, max(sdBox(cab.xy, vec2(0.72, 1.05)) - 0.1, abs(cab.z) - 0.42));
    if (car < d){ d = car; id = 4.0 + fract(hash11(cid * 3.1) * 7.0) * 0.9; }
  }
  d = max(d, max(-60.0 - u.y, u.y - FD_SEND));
  return d;
}

vec3 fdSky(vec3 rd, float t){
  float h = rd.y;
  vec3 c = mix(vec3(0.86, 0.80, 0.70), vec3(0.42, 0.62, 0.88), smoothstep(-0.1, 0.6, h));
  c = mix(c, vec3(0.20, 0.38, 0.72), smoothstep(0.5, 1.0, h));
  vec2 cq = rd.xz / max(rd.y + 0.25, 0.08);
  float cl = fbm4(cq * 1.2 + vec2(t * 0.01, 0.0));
  c = mix(c, vec3(1.0, 0.97, 0.92), smoothstep(0.50, 0.75, cl) * smoothstep(-0.1, 0.3, h) * 0.8);
  vec3 sd = normalize(vec3(-0.45, 0.55, -0.35));
  c += vec3(1.0, 0.9, 0.7) * pow(max(dot(rd, sd), 0.0), 40.0) * 0.6;
  return c;
}

/* facade: windows with iron balconies, cornices, shopfronts with awnings, mansards with dormers */
vec3 fdFacade(float s, float h, float side, float pw){
  float seg = floor(s / 17.0);
  float hs = hash11(seg * 3.1 + side * 7.0);
  vec3 stone = mix(vec3(0.86, 0.80, 0.68), vec3(0.78, 0.70, 0.58), hs);
  float lod = smoothstep(0.08, 0.35, pw);
  vec3 c = stone * (0.92 + 0.08 * vnoise(vec2(s * 0.6, h * 0.6)));
  float ws = 2.85;
  float wx = fract(s / ws) - 0.5;
  float fl = floor((h - 4.4) / 3.05);
  float fy = fract((h - 4.4) / 3.05);
  if (h < 4.4){
    // shopfronts: dark glass behind an awning
    float shop = step(abs(fract(s / 5.7) - 0.5), 0.40);
    vec3 glass = vec3(0.10, 0.12, 0.13) + vec3(0.9, 0.8, 0.6) * 0.10 * step(0.6, hash11(floor(s / 5.7) + side));
    c = mix(c, glass, shop * step(0.3, h) * step(h, 3.4) * (1.0 - lod * 0.5));
    float aw = step(3.3, h) * step(h, 4.1) * shop;
    vec3 awc = hs < 0.33 ? vec3(0.55, 0.10, 0.10) : hs < 0.66 ? vec3(0.10, 0.30, 0.18) : vec3(0.12, 0.18, 0.40);
    awc = mix(awc, vec3(0.9, 0.88, 0.82), step(0.5, fract(s * 1.4)) * 0.6);
    c = mix(c, awc, aw);
  } else if (h < 18.6){
    float win = step(abs(wx), 0.21) * step(0.12, fy) * step(fy, 0.86);
    vec3 wcol = vec3(0.14, 0.16, 0.19) + vec3(0.55, 0.62, 0.75) * 0.25 * step(0.5, fy);
    c = mix(c, wcol, win * (1.0 - lod * 0.6));
    // the window surround, and the iron balcony rail at its foot
    c = mix(c, stone * 1.06, step(abs(abs(wx) - 0.23), 0.025) * step(0.10, fy) * step(fy, 0.90) * (1.0 - lod));
    float bal = (step(abs(fl - 1.0), 0.1) + step(abs(fl - 4.0), 0.1)) > 0.0 ? 1.0 : step(abs(wx), 0.26);
    float rail = step(0.10, fy) * step(fy, 0.30) * bal;
    float bars = step(0.55, fract(s * 9.0)) + step(0.24, fy) * step(fy, 0.27);
    c = mix(c, vec3(0.06, 0.06, 0.07), rail * clamp(bars, 0.0, 1.0) * (1.0 - lod) * 0.9);
    c = mix(c, vec3(0.08, 0.08, 0.09), rail * lod * 0.25);
  } else {
    // the mansard: dark zinc with dormer windows
    vec3 zinc = vec3(0.30, 0.33, 0.38) * (0.85 + 0.15 * step(0.5, fract(s * 2.0)));
    float dorm = step(abs(wx), 0.17) * step(19.2, h) * step(h, 20.8);
    c = mix(zinc, vec3(0.10, 0.11, 0.13), dorm * (1.0 - lod * 0.5));
    c = mix(c, stone, step(abs(wx), 0.22) * step(20.8, h) * step(h, 21.2) * (1.0 - lod));
  }
  // cornices: a pale ledge with a shadow beneath
  for (int i = 0; i < 3; i++){
    float ch = i == 0 ? 4.4 : i == 1 ? 10.5 : 18.6;
    c = mix(c, stone * 1.10, smoothstep(0.18, 0.0, abs(h - ch - 0.12)));
    c *= 1.0 - 0.35 * smoothstep(0.35, 0.0, ch - h) * step(h, ch);
  }
  // seams between neighbouring buildings
  c *= 1.0 - 0.25 * smoothstep(0.25, 0.0, abs(fract(s / 17.0) - 0.0) * 17.0) * (1.0 - lod);
  return c;
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  float z0 = fdZ0(t);

  vec3 ro = vec3(m.x * 1.2, m.y * 0.4, 0.0);
  float pitch = 0.40;
  vec3 rd = normalize(vec3(p.x, p.y, 1.0));
  rd = vec3(rd.x, rd.y * cos(pitch) + rd.z * sin(pitch), -rd.y * sin(pitch) + rd.z * cos(pitch));

  // march the folded city
  float tt = 0.2, id = 0.0;
  bool hit = false;
  vec3 u;
  for (int i = 0; i < 110; i++){
    vec3 P = ro + rd * tt;
    u = fdUnfold(P, z0);
    float d = fdMap(u, id);
    if (d < 0.002 * tt + 0.01){ hit = true; break; }
    tt += d * 0.75;
    if (tt > 1400.0) break;
  }
  vec3 col = fdSky(rd, t);
  if (hit){
    vec3 P = ro + rd * tt;
    float pw = px * tt;
    // the surface's 'up' in the world, which turns as the street climbs the fold
    vec3 up;
    float yc = FD_R - FD_E;
    if (P.z < z0) up = P.y < yc ? vec3(0.0, 1.0, 0.0) : vec3(0.0, -1.0, 0.0);
    else up = normalize(vec3(0.0, yc - P.y, z0 - P.z));
    vec3 sunD = normalize(vec3(-0.45, 0.55, -0.35));
    vec3 n; vec3 c;
    float ax = abs(u.x);
    if (id < 0.5){
      // the street: asphalt, a dashed centre line, pale pavements and kerbs
      n = up;
      float kerb = FD_W - 5.0;
      float road = step(ax, kerb);
      vec3 pave = vec3(0.70, 0.67, 0.62) * (0.88 + 0.12 * vnoise(u.xy * 2.0));
      pave *= 1.0 - 0.10 * (step(0.94, fract(u.y * 0.8)) + step(0.94, fract(ax * 0.8))) * (1.0 - smoothstep(0.05, 0.3, pw));
      vec3 asph = vec3(0.21, 0.21, 0.22) * (0.88 + 0.18 * vnoise(u.xy * 0.7));
      c = mix(pave, asph, road);
      c = mix(c, vec3(0.80, 0.80, 0.76), step(abs(ax - kerb), 0.15) * (1.0 - smoothstep(0.1, 0.4, pw)));
      float dash = step(abs(ax - kerb * 0.5), 0.10) * step(0.5, fract(u.y / 6.0)) + step(ax, 0.10);
      c = mix(c, vec3(0.86, 0.86, 0.82), clamp(dash, 0.0, 1.0) * road * (1.0 - smoothstep(0.1, 0.5, pw)));
      float block = mod(u.y, 80.0);
      c = mix(c, vec3(0.86, 0.86, 0.82), step(block, 15.0) * step(11.0, block) * road * step(0.5, fract(u.x * 0.7)) * (1.0 - smoothstep(0.1, 0.5, pw)));
      // the shade of the trees on the pavement
      c *= 1.0 - 0.25 * smoothstep(3.8, 2.0, length(vec2(ax - (FD_W - 3.2) + 1.2, mod(u.y + 4.0, 10.0) - 5.0 + 1.0))) * (1.0 - road);
    } else if (id < 1.5){
      // facade or roof: whichever face the block's distance comes from
      float block = mod(u.y, 80.0);
      float fFac = FD_W - ax, fRoof = u.z - FD_H, fSide = 15.0 - block;
      if (fRoof > fFac && (block > 15.0 || fRoof > fSide)){
        n = up;
        float seam = smoothstep(0.08, 0.0, abs(fract(u.y * 1.6) - 0.5) - 0.42) * (1.0 - smoothstep(0.05, 0.25, pw));
        c = vec3(0.36, 0.39, 0.44) * (0.88 + 0.12 * vnoise(vec2(u.x * 0.3, u.y * 0.05)));
        c *= 1.0 - 0.18 * seam;
        float ridge = smoothstep(1.2, 0.0, abs(mod(ax - FD_W, 14.0) - 7.0));
        c += vec3(0.10, 0.10, 0.11) * ridge;

      } else if (fFac >= fSide || block > 15.0){
        n = normalize(cross(up, vec3(1.0, 0.0, 0.0))) * 0.0 + vec3(-sign(u.x), 0.0, 0.0);
        c = fdFacade(u.y, u.z, sign(u.x), pw);
      } else {
        // the side wall at a cross street
        n = vec3(0.0) + normalize(cross(vec3(1.0, 0.0, 0.0), up)) * sign(mod(u.y, 74.0) - 6.5);
        c = vec3(0.80, 0.74, 0.62) * (0.9 + 0.1 * vnoise(u.yz));
      }
    } else if (id < 1.8){
      // chimney stacks: pale render with clay pots on top
      n = up;
      c = mix(vec3(0.70, 0.60, 0.50), vec3(0.60, 0.34, 0.22), step(FD_H + 1.9, u.z));
    } else if (id < 2.5){
      n = up; c = vec3(0.38, 0.33, 0.26) * (0.8 + 0.3 * vnoise(u.yz * 4.0));
    } else if (id < 3.5){
      // plane tree crowns: clumps of leaves, lit on top, dark beneath
      n = up;
      vec3 tq = vec3(ax - (FD_W - 3.2), mod(u.y + 4.0, 10.0) - 5.0, u.z - 6.6);
      vec3 C = clump2(vec2(atan(tq.x, tq.y) * 4.5, tq.z * 2.6) + floor((u.y + 4.0) / 10.0) * 3.0, 1.0);
      float lv = vnoise(u.xy * 3.0 + u.z);
      c = mix(vec3(0.14, 0.22, 0.08), vec3(0.40, 0.48, 0.18), clamp(0.35 + 0.45 * (-C.z) + 0.25 * lv + 0.2 * tq.z / 3.0, 0.0, 1.0));
      c *= 0.85 + 0.25 * smoothstep(0.0, 0.6, C.x);
    } else {
      // cars: painted bodies with dark glass
      n = up;
      float hue = fract(id) / 0.9;
      vec3 paint = hue < 0.2 ? vec3(0.55, 0.08, 0.06) : hue < 0.4 ? vec3(0.10, 0.18, 0.35) : hue < 0.6 ? vec3(0.80, 0.80, 0.78) : hue < 0.8 ? vec3(0.08, 0.08, 0.09) : vec3(0.22, 0.35, 0.28);
      c = mix(paint, vec3(0.10, 0.12, 0.15), step(1.25, u.z) * 0.85);
    }
    float dif = max(dot(n, sunD), 0.0);
    float amb = 0.55 + 0.25 * dot(n, up);
    float ao = 0.70 + 0.30 * smoothstep(0.0, 6.0, u.z);
    c *= (amb * 0.52 + dif * vec3(1.0, 0.88, 0.70) * 0.95) * ao;
    c += vec3(1.0, 0.80, 0.55) * dif * 0.05;
    // aerial perspective: the far side of the fold goes blue
    col = mix(c, fdSky(rd, t) * vec3(0.95, 0.97, 1.0), 1.0 - exp(-tt * 0.0016));
  }
  col = filmic(col * 1.05);
  col = grade(col, vec3(0.94, 0.97, 1.06), vec3(1.05, 1.0, 0.92), 0.4);
  return col;
}`;
