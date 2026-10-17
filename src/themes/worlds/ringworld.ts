/* Ringworld at night: a colossal ring rises from the horizon and arches across a sky full of stars,
   nebulae and the galaxy's band; its near reach is in night, pricked with city lights, its far side still
   in sunlight. A giant planet hangs as a thin crescent. Far below, a moonless valley glows with living
   light; its river pours over a horseshoe of falls into a gorge, the spray climbing in a glowing plume; the
   builders' pylon burns on our spur. */

export const ringworld = /* glsl */ `
const float RW_HZ = -0.040;               // horizon
const vec2 RW_C = vec2(-0.58, -1.62);     // centre of the ring's arc on screen
const float RW_R = 1.995;
const vec2 RW_PL = vec2(-0.42, 0.21);     // the giant planet
const float RW_PLR = 0.27;
const float RW_H = 1100.0;                // our height above the valley floor, metres
const vec3 RW_RING_LIGHT = vec3(0.55, 0.66, 0.85);   // the light the sunlit arch throws down on the night side

/* a bright star with a soft halo and four-point spikes */
vec3 rwBright(vec2 p, vec2 c, float s, vec3 tint, float t, float ph){
  vec2 d = p - c;
  float r = length(d);
  if (r > 0.08 * s) return vec3(0.0);
  float tw = 0.80 + 0.20 * sin(t * 2.3 + ph);
  float core = exp(-r * r / (0.000004 * s * s));
  float halo = exp(-r / (0.006 * s)) * 0.35;
  float spikes = (exp(-abs(d.x) / (0.0006 * s)) * exp(-abs(d.y) / (0.030 * s)) + exp(-abs(d.y) / (0.0006 * s)) * exp(-abs(d.x) / (0.030 * s))) * 0.5;
  return tint * (core * 2.0 + halo + spikes) * tw;
}

vec3 rwSpace(vec2 p, float t, float px){
  float h = p.y - RW_HZ;
  vec3 c = mix(vec3(0.045, 0.050, 0.120), vec3(0.012, 0.010, 0.035), smoothstep(0.0, 0.5, h));
  c += vec3(0.06, 0.16, 0.18) * exp(-max(h, 0.0) * 10.0) * 0.55;                  // airglow along the horizon
  // the galaxy's band, crossing high and diagonal, mottled with dark dust
  vec2 gq = rot2(-0.42) * (p - vec2(0.12, 0.22));
  float band = exp(-gq.y * gq.y * 14.0);
  float glow = fbm4(gq * vec2(4.0, 9.0) + 1.0);
  float dust = fbm4(gq * vec2(3.0, 12.0) + vec2(4.0, fbm3(gq * 6.0) * 0.6));
  vec3 gal = mix(vec3(0.42, 0.38, 0.66), vec3(1.0, 0.84, 0.70), smoothstep(0.35, 0.75, glow));
  gal *= band * (0.30 + 0.75 * glow);
  gal *= 1.0 - 0.85 * smoothstep(0.48, 0.66, dust) * smoothstep(0.1, 0.9, band);
  c += gal * 0.55;
  // nebulae: rose and teal gas lit from within, a hot orange heart, filaments of dust across them
  vec2 nq = p * 1.7 + vec2(t * 0.0015, 0.0);
  float wv = fbm4(nq * 1.6 + 3.0);
  float na = fbm4(nq + wv * 1.3);
  float nb = fbm4(nq * 1.25 + 7.0 + vec2(wv, -wv) * 0.9);
  float ra = exp(-length((p - vec2(-0.05, 0.36)) * vec2(0.85, 1.5)) * 2.1);
  float rb = exp(-length((p - vec2(0.44, 0.30)) * vec2(1.0, 1.3)) * 2.6);
  vec3 neb = vec3(0.95, 0.20, 0.55) * smoothstep(0.42, 0.82, na) * ra;
  neb += vec3(0.12, 0.70, 0.78) * smoothstep(0.46, 0.84, nb) * rb;
  neb += vec3(0.45, 0.25, 0.85) * smoothstep(0.50, 0.85, nb) * ra * 0.7;
  neb += vec3(1.0, 0.58, 0.22) * smoothstep(0.62, 0.92, na * 0.6 + nb * 0.6) * exp(-length(p - vec2(0.10, 0.40)) * 4.0);
  neb *= 1.0 - 0.75 * smoothstep(0.55, 0.72, fbm4(nq * 2.6 + 11.0));
  c += neb * 0.65;
  // stars: a dense haze of faint ones, sparser bright ones, a handful with spikes
  float skyF = smoothstep(-0.01, 0.04, h);
  c += starfield(p, 260.0, 0.93, t, px) * 0.40 * skyF;
  c += starfield(p + 3.7, 110.0, 0.955, t, px) * 0.75 * skyF;
  c += starfield(p + 1.3, 46.0, 0.982, t, px) * 1.3 * skyF;
  c += rwBright(p, vec2(0.62, 0.42), 1.0, vec3(0.80, 0.88, 1.0), t, 0.0);
  c += rwBright(p, vec2(0.14, 0.11), 0.7, vec3(1.0, 0.86, 0.70), t, 2.0);
  c += rwBright(p, vec2(-0.70, 0.46), 0.8, vec3(0.90, 0.92, 1.0), t, 4.0);
  c += rwBright(p, vec2(0.30, 0.47), 0.6, vec3(1.0, 0.75, 0.85), t, 1.0);
  return c;
}

/* the giant planet: a thin crescent where the hidden sun catches its limb, the night side dim with ringshine
   and storms flickering in its bands */
vec4 rwPlanet(vec2 p, float t, float px){
  vec2 q = (p - RW_PL) / RW_PLR;
  float r = length(q);
  if (r > 1.25) return vec4(0.0);
  vec3 n = vec3(q, sqrt(max(1.0 - r * r, 0.0)));
  vec2 bq = rot2(0.32) * q;
  float lat = bq.y / max(n.z, 0.2) * 0.35 + bq.y * 0.65;
  float warp = fbm4(vec2(bq.x * 2.0 + t * 0.004, lat * 6.0)) - 0.5;
  float band = fbm4(vec2(lat * 10.0 + warp * 0.8, bq.x * 0.7));
  vec3 c = mix(vec3(0.88, 0.74, 0.54), vec3(0.58, 0.64, 0.68), smoothstep(0.36, 0.62, band));
  c = mix(c, vec3(0.70, 0.48, 0.34), smoothstep(0.60, 0.74, fbm4(vec2(lat * 24.0 + warp, bq.x * 1.5))) * 0.55);
  vec3 L = normalize(vec3(0.80, 0.30, -0.75));
  float lit = smoothstep(0.0, 0.35, dot(n, L));
  vec3 col = c * lit * 0.85;
  col += c * vec3(0.30, 0.40, 0.60) * 0.10 * (1.0 - lit);                       // ringshine on the night side
  // lightning in the storm bands of the dark side
  vec2 sg = floor(bq * 5.0);
  float fl = step(0.93, hash21(sg + floor(t * 2.0))) * exp(-length(fract(bq * 5.0) - 0.5) * 6.0);
  fl *= smoothstep(0.45, 0.65, fbm4(vec2(lat * 14.0, bq.x * 3.0)));               // only inside the cloud bands
  col += vec3(0.55, 0.65, 1.0) * fl * (1.0 - lit) * 0.18 * step(r, 1.0);
  // atmosphere: a bright rim along the crescent, a faint ring all round
  float rim = smoothstep(1.0, 0.94, r) * smoothstep(0.80, 1.0, r);
  float limb = exp(-abs(r - 1.0) * 40.0);
  col += vec3(0.45, 0.75, 1.0) * limb * (0.12 + 1.1 * smoothstep(-0.3, 0.6, dot(normalize(vec3(q, 0.0)), L)));
  col += vec3(0.6, 0.8, 1.0) * rim * lit * 0.3;
  float a = af(r - 1.0, px / RW_PLR);
  return vec4(col, max(a, limb * 0.8 * step(1.0, r)));
}

/* the ring: an arch of land, sea and cloud between two great walls. Its foot near us lies in night,
   pricked with the lights of cities; higher up it crosses into the sunlight it still holds */
vec4 rwRing(vec2 p, float t, float px){
  vec2 d = p - RW_C;
  float rho = length(d);
  float a = atan(d.y, d.x);
  float s = (a - 0.92) / 0.80;
  if (s < -0.05 || s > 1.05) return vec4(0.0);
  float w = 0.205 * exp(-s * 3.4) + 0.010;
  float v = (rho - RW_R) / w;
  if (v < -0.62 || v > 0.66) return vec4(0.0);
  float L = (exp(s * 3.4) - 1.0) * 1.4 + s * 6.0;
  vec2 mq = vec2(L, v);
  float land = fbm4(mq * 1.3 + 4.0) + 0.28 * fbm4(mq * 4.2 + 1.0);
  vec3 sea = mix(vec3(0.14, 0.28, 0.44), vec3(0.28, 0.46, 0.58), smoothstep(0.28, 0.46, land));
  vec3 grn = mix(vec3(0.30, 0.42, 0.26), vec3(0.58, 0.54, 0.42), smoothstep(0.55, 0.85, fbm4(mq * 3.2 + 9.0)));
  grn = mix(grn, vec3(0.86, 0.86, 0.84), smoothstep(0.80, 0.92, land) * 0.75);
  float isLand = smoothstep(0.48, 0.52, land);
  vec3 c = mix(sea, grn, isLand);
  float cl = fbm4(vec2(L * 1.7 + t * 0.012, v * 2.4) + 2.0) + 0.3 * fbm4(vec2(L * 5.0 - t * 0.01, v * 6.0));
  float cloud = smoothstep(0.55, 0.80, cl);
  c = mix(c, vec3(0.96, 0.97, 0.99), cloud * 0.92);
  // day and night along it: sunlit from s ~ 0.5 on, with a soft terminator glowing at dusk
  float day = smoothstep(0.38, 0.55, s + 0.04 * v);
  float dusk = exp(-pow((s + 0.04 * v - 0.46) * 12.0, 2.0));
  vec3 night = vec3(0.012, 0.016, 0.03) + vec3(0.02, 0.03, 0.05) * cloud;
  // city lights on the night side: clustered on the land, strung along coasts, dimmed under cloud
  vec2 cg = mq * vec2(22.0, 14.0);
  float city = step(0.72, hash21(floor(cg))) * smoothstep(0.35, 0.0, length(fract(cg) - 0.5 - (hash22(floor(cg)) - 0.5) * 0.4));
  float urban = smoothstep(0.35, 0.65, fbm4(mq * 2.2 + 5.0));
  city *= isLand * urban * (1.0 - cloud * 0.8);
  night += vec3(1.0, 0.70, 0.35) * city * 1.4 * (0.8 + 0.2 * sin(t * 3.0 + floor(cg.x) * 1.7));
  night += vec3(1.0, 0.62, 0.30) * isLand * urban * (1.0 - cloud) * 0.05;
  c = mix(night, saturate3(c, 0.75) * 0.80, day) + vec3(1.0, 0.55, 0.30) * dusk * 0.25;
  // the walls
  float wIn = smoothstep(-0.44, -0.49, v), wOut = smoothstep(0.44, 0.49, v);
  vec3 wallIn = mix(vec3(0.05, 0.06, 0.09), vec3(0.85, 0.88, 0.94), day) * (0.9 + 0.1 * sin(L * 40.0));
  c = mix(c, wallIn, wIn);
  c = mix(c, mix(vec3(0.03, 0.04, 0.06), vec3(0.30, 0.34, 0.42), day), wOut);
  c += vec3(0.85, 0.92, 1.0) * smoothstep(0.012, 0.0, abs(v - 0.495)) * (0.15 + 0.55 * day);
  // navigation beacons blinking along the wall crests
  float bcn = step(0.5, fract(L * 3.0)) * smoothstep(0.02, 0.0, abs(fract(L * 3.0) - 0.75) * w * 8.0) * smoothstep(0.015, 0.0, abs(v + 0.47));
  c += vec3(1.0, 0.25, 0.20) * bcn * step(0.6, fract(t * 0.8 + floor(L * 3.0) * 0.37)) * (1.0 - day);
  float hull = smoothstep(0.50, 0.53, v);
  vec3 hc = vec3(0.06, 0.07, 0.09) * (0.85 + 0.25 * smoothstep(0.9, 0.97, fract(L * 2.0)));
  hc += vec3(0.30, 0.85, 1.0) * smoothstep(0.92, 0.97, fract(L * 6.0)) * smoothstep(0.62, 0.56, v) * 0.15;
  c = mix(c, hc, hull);
  // the far reaches dim with distance; its foot sinks into the dark horizon
  c *= 1.0 - 0.45 * smoothstep(0.55, 1.0, s);
  c = mix(c, vec3(0.03, 0.05, 0.09), 0.85 * exp(-s * 7.0));
  float cov = af(max(-0.5 - v, v - 0.62) * w, px);
  cov *= smoothstep(RW_HZ - 0.004, RW_HZ + 0.02, p.y);
  return vec4(c, cov);
}

/* the great falls: the valley's river spreads over a broad lip of rock and drops into a gorge it has cut back into
   the valley floor, throwing up a plume of spray that climbs, glowing, high into the night */
const float RW_FZ = 5600.0;               // distance of the lip at the head of the gorge (m)
const float RW_FD = 240.0;                // how far the water falls (m)
const float RW_FW = 640.0;                // half the width of the lip (m)
const float RW_FK = 0.0018;               // how sharply the lip curves round into a horseshoe

float rwRiverX(float z){ return 380.0 * sin(z * 0.00082 + 0.6) + 600.0 * sin(z * 0.00029 + 2.0) - 650.0; }

// the gorge's centre and half-width (m) at distance z: the horseshoe at its head, then a cleft running toward us
vec2 rwGorge(float z){
  float XH = rwRiverX(RW_FZ);
  float zArm = RW_FZ - RW_FK * RW_FW * RW_FW;
  float hw = z > zArm ? sqrt(max(RW_FZ - z, 0.0) / RW_FK) : mix(170.0, RW_FW, smoothstep(zArm - 800.0, zArm, z));
  hw += (40.0 * (n1(z / 120.0) - 0.5) + 20.0 * (n1(z / 37.0 + 4.0) - 0.5)) * smoothstep(RW_FZ - 200.0, zArm, z);
  return vec2(mix(XH, rwRiverX(z), smoothstep(zArm, zArm - 800.0, z)), hw);
}

/* the plume of spray over the gorge: billows lit from above by the arch and from below by the forest's light,
   leaning with the wind and thinning to rags as it climbs. premultiplied colour, coverage */
vec4 rwPlume(vec2 p, float Z, float Xc, float t){
  float X = p.x * Z;
  float h = RW_H - (RW_HZ - p.y) * Z;
  float hh = h + RW_FD;                                   // height above the gorge floor
  if (hh < -60.0 || hh > 1600.0) return vec4(0.0);
  float hp = max(hh, 0.0);
  float R = 380.0 + 0.45 * hp;
  float cx = Xc + 0.22 * hp + 35.0 * sin(hp / 190.0 - t * 0.15);
  float qx = (X - cx) / R;
  if (abs(qx) > 2.2) return vec4(0.0);
  float env = exp(-qx * qx * 1.5) * smoothstep(1450.0, 150.0, hp) * smoothstep(-40.0, 60.0, hh);
  vec2 nq = vec2((X - cx) / 130.0, h / 120.0 - t * 0.14);
  float wv = fbm3(nq * 0.6 + vec2(t * 0.03, 0.0));
  float n = fbm4(nq + wv * 1.3);
  float nU = fbm4(nq + vec2(0.0, 0.35) + wv * 1.3);
  float base = exp(-qx * qx * 1.2) * smoothstep(320.0, 40.0, hp) * smoothstep(-60.0, 40.0, hh);
  float dens = clamp(env * (n * 2.0 - 0.36) + base * (0.35 + 0.5 * n), 0.0, 1.0);
  float lit = clamp(0.5 + (n - nU) * 2.5, 0.0, 1.0);
  vec3 c = mix(vec3(0.12, 0.15, 0.22), vec3(0.58, 0.66, 0.82), lit);
  c += vec3(0.05, 0.28, 0.27) * smoothstep(320.0, 0.0, hp) * 0.45;
  c += vec3(0.30, 0.34, 0.42) * base * 0.5;                // the foot, lit by the falling water
  c = mix(c, vec3(0.03, 0.05, 0.09), 1.0 - exp(-Z * 0.00009));
  float a = dens * 0.82 + env * 0.10;
  return vec4(c * a, clamp(a, 0.0, 1.0));
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 p0 = p + m * vec2(0.003, 0.002);

  vec3 col = rwSpace(p0, t, px);
  vec4 pl = rwPlanet(p0, t, px);
  col = mix(col, pl.rgb, pl.a);
  vec4 rg = rwRing(p0, t, px);
  col = mix(col, rg.rgb, rg.a);

  // far ranges on the horizon, black against the airglow, a rim of ringlight on their crests
  vec2 p1 = p + m * vec2(0.006, 0.003);
  {
    float rr = ridge1(p1.x * 3.0 + 1.0);
    float m1 = RW_HZ + 0.018 + 0.034 * rr * smoothstep(-0.9, 0.1, p1.x);
    if (p1.y < m1 + px * 2.0){
      vec3 mc = mix(vec3(0.020, 0.028, 0.050), vec3(0.04, 0.06, 0.09), smoothstep(m1, RW_HZ - 0.01, p1.y));
      mc += RW_RING_LIGHT * exp(-(m1 - p1.y) * 300.0) * 0.12;
      col = mix(col, mc, af(p1.y - m1, px));
    }
  }

  // the valley floor at night: lit only by the arch overhead, rivers and lakes holding the stars,
  // forests speckled with living light, villages strung along the river
  vec2 p2 = p + m * vec2(0.012, 0.005);
  if (p2.y < RW_HZ){
    float z = RW_H / (RW_HZ - p2.y);
    float X = p2.x * z;
    vec2 w = vec2(X, z);
    float pw = px * z;
    float lod = smoothstep(15.0, 160.0, pw);
    float f = fbm4(w * 0.0010 + 3.0);
    float f2 = fbm4(w * 0.0050 + 7.0);
    float forest = smoothstep(0.42, 0.56, f + (f2 - 0.45) * 0.35);
    vec3 meadow = vec3(0.040, 0.060, 0.058) + RW_RING_LIGHT * 0.08 * (0.7 + 0.6 * fbm4(w * 0.0022 + 1.0));
    vec3 trees = vec3(0.010, 0.020, 0.020);
    vec3 c = mix(meadow, trees, forest);
    // glow-flora: tiny lights in the forest, thicker near the water
    float rx = rwRiverX(z);
    float rw = 40.0 + 28.0 * sin(z * 0.0021);
    float nearRiver = exp(-abs(X - rx) / 500.0);
    vec2 bg = w * 0.025;
    float bio = step(0.80 - 0.10 * nearRiver, hash21(floor(bg))) * smoothstep(0.35, 0.0, length(fract(bg) - 0.5)) * forest;
    c += mix(vec3(0.10, 0.85, 0.75), vec3(0.65, 0.35, 1.0), hash21(floor(bg) + 5.0)) * bio * (0.6 + 0.4 * sin(t * 1.5 + hash21(floor(bg)) * 20.0)) * (1.0 - lod * 0.6) * 0.5;
    c += vec3(0.05, 0.40, 0.38) * forest * nearRiver * 0.06;
    c += vec3(0.06, 0.42, 0.38) * smoothstep(0.55, 0.80, fbm4(w * 0.0030 + 21.0)) * forest * (1.0 - lod * 0.5) * 0.18;
    float river = smoothstep(rw + pw * 1.5, rw - pw * 0.5, abs(X - rx));
    float lake = smoothstep(0.30, 0.275, fbm4(w * 0.0007 + 13.0));
    float water = max(river, lake);
    // the water mirrors the sky: the nebula's colours, the arch's light, stars trembling in it
    vec2 mp = vec2(p2.x, RW_HZ + (RW_HZ - p2.y) * 0.9);
    vec3 refl = vec3(0.03, 0.04, 0.08) + vec3(0.40, 0.14, 0.38) * exp(-length((mp - vec2(-0.05, 0.10)) * vec2(0.8, 2.0)) * 2.0) * 0.4;
    refl += RW_RING_LIGHT * exp(-abs(p2.x - 0.45) * 3.0) * 0.18;
    vec2 sg = vec2(p2.x * 200.0, z * 0.02 + t * 0.5);
    refl += vec3(0.8, 0.85, 1.0) * step(0.97, hash21(floor(sg))) * smoothstep(0.3, 0.0, length(fract(sg) - 0.5)) * 0.6;
    c = mix(c, refl, water);
    // villages along the banks: warm windows in clusters
    vec2 vg = vec2((X - rx) * 0.02, z * 0.004);
    float village = step(0.75, hash21(floor(vg * 0.25))) * step(0.55, hash21(floor(vg * 3.0))) * smoothstep(0.35, 0.0, length(fract(vg * 3.0) - 0.5));
    village *= smoothstep(260.0, 60.0, abs(X - rx)) * (1.0 - water);
    c += vec3(1.0, 0.66, 0.30) * village * 0.9;
    // the great falls: rapids fanning out over a broad lip, a curtain of water dropping into the gorge it has
    // cut, the gorge running on toward us with the river white in its bed
    {
      float XH = rwRiverX(RW_FZ);
      // the lip under this column: where z = FZ - FK (x z - XH)^2, then roughened
      float qa = max(RW_FK * p2.x * p2.x, 1e-9), qb = 1.0 - 2.0 * RW_FK * p2.x * XH, qc = RW_FK * XH * XH - RW_FZ;
      float zl = (-qb + sqrt(max(qb * qb - 4.0 * qa * qc, 0.0))) / (2.0 * qa);
      zl += 45.0 * (n1((p2.x * zl - XH) / 70.0) - 0.5);
      float Xl = p2.x * zl;
      float ul = (Xl - XH) / RW_FW;
      float yl = RW_HZ - RW_H / zl;
      float yb = RW_HZ - (RW_H + RW_FD) / zl;
      if (abs(ul) < 1.3 && z > zl - 2000.0 && z < zl + 1000.0){
        float faceM = smoothstep(1.0, 0.86, abs(ul));
        if (p2.y > yl){
          // rapids: the river fans out over the lip, foam streaming toward the edge
          float k = clamp((z - zl) / 900.0, 0.0, 1.0);
          float halfW = mix(RW_FW, rw, sqrt(k));
          float sheet = smoothstep(halfW + pw, halfW - pw, abs(X - mix(XH, rx, k))) * step(z, zl + 900.0);
          float foam = smoothstep(0.30, 0.80, vnoise(vec2((X - XH) / 16.0, (z - zl) / 50.0 + t * 0.7))) * (0.45 + 0.55 * (1.0 - k));
          vec3 wc = mix(mix(refl, vec3(0.14, 0.18, 0.26), 0.5), vec3(0.62, 0.70, 0.84), foam * 0.8);
          wc += vec3(0.80, 0.86, 0.98) * 0.35 * smoothstep(3.0 * px, 0.0, p2.y - yl);    // the glassy edge
          c = mix(c, wc, sheet);
        } else if (p2.y > yb){
          // the curtain: water where the lip runs, dark wet rock between, streaks racing down
          float hf = (yl - p2.y) / (yl - yb);
          float dx = Xl - XH;
          float wet = smoothstep(0.30, 0.44, n1(dx / 60.0 + 3.0) * 0.6 + n1(dx / 19.0 + 8.0) * 0.4 + 0.16 * (1.0 - abs(ul))) * smoothstep(0.92, 0.70, abs(ul));
          float st = vnoise(vec2(dx / 8.0, hf * 2.5 - t * 1.4)) * 0.6 + vnoise(vec2(dx / 3.5, hf * 5.0 - t * 2.1)) * 0.4;
          vec3 water = mix(vec3(0.28, 0.36, 0.50), vec3(0.84, 0.90, 1.0), smoothstep(0.30, 0.80, st));
          vec3 rock = vec3(0.014, 0.018, 0.026) + RW_RING_LIGHT * 0.03 * (1.0 - hf);
          vec3 cur = mix(rock, water, wet * (1.0 - 0.25 * hf));
          cur = mix(cur, vec3(0.50, 0.57, 0.70), smoothstep(0.35, 1.0, hf) * 0.85 * smoothstep(0.95, 0.55, abs(ul)));    // the foot lost in spray
          c = mix(c, cur, faceM);
        } else {
          // the gorge: looking down into it, its floor and the river, its left wall in shadow
          vec2 g0 = rwGorge(z);
          float gx0 = g0.x, gw0 = g0.y;
          float gEnd = smoothstep(RW_FZ - 2500.0, RW_FZ - 2300.0, z);
          float inG = smoothstep(gw0 + pw, gw0 - pw, abs(X - gx0)) * gEnd;
          if (inG > 0.0){
            float zf = (RW_H + RW_FD) / (RW_HZ - p2.y);
            float Xf = p2.x * zf;
            vec2 gf = rwGorge(zf);
            float gxf = gf.x;
            float floorV = smoothstep(gf.y + 15.0, gf.y - 15.0, abs(Xf - gxf));
            float rv = smoothstep(60.0, 22.0, abs(Xf - gxf));
            float foam = smoothstep(0.35, 0.80, vnoise(vec2((Xf - gxf) / 14.0, zf / 40.0 + t * 0.8)));
            vec3 fl = vec3(0.010, 0.014, 0.020) + vec3(0.34, 0.42, 0.56) * rv * (0.45 + 0.40 * foam) * smoothstep(RW_FZ - 2400.0, RW_FZ - 1600.0, zf);
            fl += vec3(0.16, 0.20, 0.28) * 0.55 * smoothstep(RW_FZ - 2000.0, RW_FZ, zf);   // spray hanging in the gorge
            float zw = (gx0 - gw0) / min(p2.x, -1e-4);                             // where the sight line meets the left wall
            float hwl = clamp((RW_H - (RW_HZ - p2.y) * zw) / RW_FD + 1.0, 0.0, 1.0);
            vec3 wall = vec3(0.016, 0.020, 0.030) + RW_RING_LIGHT * 0.06 * hwl * hwl + vec3(0.16, 0.20, 0.28) * 0.35 * smoothstep(RW_FZ - 1800.0, RW_FZ, zw);
            c = mix(c, mix(wall, fl, floorV), inG);
          }
          c += RW_RING_LIGHT * 0.10 * smoothstep(2.5 * pw, 0.0, abs(abs(X - gx0) - gw0)) * gEnd * step(z, zl);
        }
      }
    }
    c = mix(c, vec3(0.03, 0.05, 0.09), 1.0 - exp(-z * 0.00009));
    // luminous mist lying in the low ground, drifting
    float vm = smoothstep(0.55, 0.80, fbm4(vec2(X * 0.0006 - t * 0.01, z * 0.0011)));
    c += vec3(0.10, 0.14, 0.22) * vm * 0.55;
    col = c;
    // low cloud drifting below us, its tops silvered by the arch's light
    float zc = (RW_H - 450.0) / (RW_HZ - p2.y);
    vec2 cw = vec2(p2.x * zc, zc);
    vec2 cq = cw * 0.0013 + vec2(t * 0.012, 0.0);
    float cd = fbm4(cq) + 0.25 * fbm4(cq * 3.0);
    float cd2 = fbm4(cq + vec2(0.04, 0.03)) + 0.25 * fbm4((cq + vec2(0.04, 0.03)) * 3.0);
    float dens = smoothstep(0.66, 0.80, cd);
    vec3 cc = mix(vec3(0.03, 0.04, 0.07), RW_RING_LIGHT * 0.35, clamp((cd - cd2) * 9.0 + 0.4, 0.0, 1.0));
    col = mix(col, cc, dens * 0.9);
    // the plume over the gorge
    vec4 pl = rwPlume(p2, RW_FZ - 150.0, rwRiverX(RW_FZ) + 20.0, t);
    col = col * (1.0 - pl.a) + pl.rgb;
  }

  // our spur: dark meadow, glowing flowers, tall trees black against the stars, and the builders' pylon ablaze
  vec2 p4 = p + m * vec2(0.045, 0.016);
  float edge = -0.34 + 0.08 * smoothstep(0.15, 0.85, p4.x) + 0.015 * fbm1lo(p4.x * 7.0) - 0.08 * smoothstep(-0.05, -0.75, p4.x);
  vec2 pyC = vec2(0.36, -0.30 + 0.48 * 0.62);
  float pyGlow = exp(-length((p4 - pyC) * vec2(1.0, 1.6)) * 5.0);
  {
    float d = p4.y - edge;
    if (d < 0.05){
      float zz = 0.06 / max(edge - p4.y + 0.012, 0.004);
      vec2 gq = vec2(p4.x * zz * 6.0, zz * 2.0);
      float gn = fbm4(gq * vec2(1.0, 0.6) + 3.0);
      vec3 grass = mix(vec3(0.010, 0.016, 0.014), vec3(0.030, 0.045, 0.035), smoothstep(0.3, 0.7, gn));
      grass *= 0.75 + 0.35 * vnoise(vec2(p4.x * 420.0, p4.y * 60.0));
      grass += RW_RING_LIGHT * exp(-abs(d) * 160.0) * 0.10;
      grass += vec3(0.30, 0.85, 1.0) * pyGlow * 0.18;
      vec3 gc = grass;
      // flowers that glow: teal, violet, rose, opening and dimming slowly
      vec2 fg = p4 * vec2(230.0, 270.0);
      vec2 fid = floor(fg);
      float fl = step(0.86, hash21(fid)) * smoothstep(0.30, 0.10, length(fract(fg) - 0.5 - (hash22(fid) - 0.5) * 0.4)) * smoothstep(-0.12, -0.005, d);
      float hue = hash21(fid + 3.0);
      vec3 fcol = hue < 0.4 ? vec3(0.15, 0.95, 0.85) : hue < 0.7 ? vec3(0.65, 0.40, 1.0) : vec3(1.0, 0.40, 0.70);
      gc += fcol * fl * (0.55 + 0.45 * sin(t * 0.8 + hue * 30.0));
      float cell = 0.004;
      float cg = floor(p4.x / cell);
      float g = 1e5;
      for (int k = -1; k <= 1; k++){
        float id = cg + float(k);
        float hh = hash11(id * 1.7);
        float bx = (id + 0.5) * cell;
        float Hh = 0.008 + 0.028 * hh * hh;
        float yy = (p4.y - edge) / Hh;
        if (yy < 0.0 || yy > 1.0) continue;
        float bend = 0.25 * sin(t * 1.1 + id * 0.7) + 0.15;
        g = min(g, abs(p4.x - bx - bend * Hh * yy * yy) - cell * 0.25 * (1.0 - yy));
      }
      vec3 bladeC = vec3(0.008, 0.012, 0.012) + RW_RING_LIGHT * 0.05 + vec3(0.30, 0.85, 1.0) * pyGlow * 0.25;
      col = mix(col, d < 0.0 ? gc : bladeC, af(min(d, g), px));
    }
    // tall trees with flat crowns: silhouettes against the stars, rimmed by the arch's light
    for (int i = 0; i < 3; i++){
      float fi = float(i);
      float tx = i == 0 ? -0.70 : (i == 1 ? -0.56 : 0.66);
      float th = i == 0 ? 0.30 : (i == 1 ? 0.22 : 0.26);
      float te = -0.34 + 0.08 * smoothstep(0.15, 0.85, tx) + 0.015 * fbm1lo(tx * 7.0) - 0.08 * smoothstep(-0.05, -0.75, tx);
      vec2 q = (p4 - vec2(tx, te)) / th;
      if (abs(q.x) > 0.6 || q.y < -0.05 || q.y > 1.12) continue;
      float trunk = sdTaper(q, vec2(0.0, 0.0), vec2(0.04 * sin(fi * 2.0), 0.80), 0.030, 0.014);
      trunk = min(trunk, sdTaper(q, vec2(0.02, 0.62), vec2(0.20, 0.86), 0.012, 0.005));
      trunk = min(trunk, sdTaper(q, vec2(0.02, 0.70), vec2(-0.18, 0.90), 0.012, 0.005));
      float D = 1.0 - length((q - vec2(0.02, 0.93)) / vec2(0.40, 0.11));
      D = max(D, 1.0 - length((q - vec2(0.20, 0.88)) / vec2(0.18, 0.07)));
      D = max(D, 1.0 - length((q - vec2(-0.20, 0.90)) / vec2(0.18, 0.07)));
      vec3 C = clump2(q * 34.0, fi);
      float F = min(C.x - 0.40 + 2.4 * D, D + 0.10);
      float pxq = px / th;
      vec3 tc = vec3(0.006, 0.008, 0.010);
      col = mix(col, tc, af(trunk, pxq));
      vec3 lc = vec3(0.006, 0.010, 0.010) + RW_RING_LIGHT * smoothstep(0.12, 0.0, F) * smoothstep(0.0, 0.8, C.y) * 0.12;
      col = mix(col, lc, af(-F * 0.03, pxq));
    }
    // the pylon: faceted dark metal, its seams and its heart of light burning against the night
    vec2 q = p4 - vec2(0.36, -0.30);
    float pyH = 0.48;
    if (abs(q.x) < 0.08 && q.y > -0.04 && q.y < pyH + 0.02){
      float yy = q.y / pyH;
      float hw = mix(0.038, 0.011, yy) + 0.012 * step(yy, 0.10);
      float sx = q.x + 0.006 * yy;
      float dP = max(abs(sx) - hw, max(-q.y - 0.04, q.y - pyH + 0.045 * smoothstep(0.0, 0.03, sx + 0.012)));
      float facet = step(0.0, sx);
      vec3 pc = mix(vec3(0.020, 0.025, 0.035), vec3(0.06, 0.08, 0.11), facet);
      pc += RW_RING_LIGHT * smoothstep(0.003, 0.0, abs(sx - hw)) * 0.25 * facet;
      float seam = smoothstep(0.0022, 0.0, abs(sx - (facet > 0.5 ? hw * 0.45 : -hw * 0.5)));
      float pulse = smoothstep(0.85, 1.0, sin(yy * 14.0 - t * 2.2) * 0.5 + 0.5);
      pc += vec3(0.30, 0.85, 1.0) * seam * (0.55 + 1.6 * pulse);
      pc += vec3(0.30, 0.85, 1.0) * smoothstep(0.010, 0.0, abs(q.y - pyH * 0.62)) * step(abs(sx), hw) * 1.4;
      col = mix(col, pc, af(dP, px));
    }
    col += vec3(0.30, 0.85, 1.0) * (exp(-length(q - vec2(0.0, pyH * 0.62)) * 30.0) * 0.30 + pyGlow * 0.05);
    // a beam from the pylon's tip into the stars, slowly pulsing
    float bx = abs(q.x + 0.004);
    float above = max(q.y - pyH, 0.0);
    col += vec3(0.30, 0.85, 1.0) * exp(-bx / (0.0015 + above * 0.004)) * step(pyH - 0.02, q.y) * exp(-above * 2.2) * (0.35 + 0.15 * sin(t * 1.3));
  }

  // glowing spores drifting up out of the valley on the night air
  for (int i = 0; i < 18; i++){
    float fi = float(i);
    float sp = 0.012 + 0.012 * hash11(fi * 1.9);
    float y = mod(hash11(fi * 3.3) * 0.8 + t * sp, 0.8) - 0.40;
    float x = (hash11(fi * 5.1) - 0.5) * 1.5 + 0.03 * sin(t * 0.4 + fi * 2.0);
    vec2 sp2 = vec2(x, y) + m * vec2(0.03, 0.01);
    float d = length(p - sp2);
    if (d > 0.03) continue;
    float r = 0.0015 + 0.0015 * hash11(fi * 7.0);
    vec3 sc = mix(vec3(0.15, 0.95, 0.85), vec3(0.75, 0.45, 1.0), hash11(fi * 2.0));
    col += sc * (exp(-d * d / (r * r)) * 0.8 + exp(-d / (r * 5.0)) * 0.08) * (0.6 + 0.4 * sin(t * 2.0 + fi));
  }

  col = filmic(col * 1.15);
  col = saturate3(col, 1.10);
  col = grade(col, vec3(0.90, 0.94, 1.12), vec3(1.04, 1.0, 0.96), 0.4);
  return col;
}`;
