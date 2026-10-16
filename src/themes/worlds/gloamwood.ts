/* Gloamwood: rusted rails running into a fog-drowned southern forest at dusk.
   Pines and moss-hung oaks wall the cut, an old boxcar sleeps on the siding, crows keep watch
   from the telegraph wires, fireflies drift in the undergrowth and the last signal still burns red. */

export const gloamwood = /* glsl */ `
const vec2 GW_VP = vec2(0.035, -0.040);    // vanishing point on the horizon
const vec2 GW_SUN = vec2(0.046, 0.002);    // the low sun, buried in fog at the end of the line
const float GW_EYE = 1.65;                 // eye height above the ground, metres
const float GW_X0 = 0.40;                  // main line centre
const float GW_X1 = -5.20;                 // siding centre
const float GW_HG = 0.7175;                // half the gauge
const float GW_LEFT = -7.9;                // where the forest starts, left and right
const float GW_RIGHT = 4.5;
const float GW_ZB0 = 10.5;                 // the boxcar, near and far ends
const float GW_ZB1 = 24.5;
const float GW_XP = 3.20;                  // the telegraph line
const float GW_ZP0 = 8.0;
const float GW_DZP = 17.0;

float gwFogK(float gy, float bank){ return 0.030 + 0.055 * exp(-max(gy, 0.0) * 0.8) * bank; }
float gwFog(float z, float gy, float bank){ return 1.0 - exp(-z * gwFogK(gy, bank)); }
vec3 gwFogCol(vec2 p){
  vec2 d = (p - GW_SUN) * vec2(0.85, 1.7);
  float g = exp(-length(d) * 2.4);
  return mix(vec3(0.17, 0.23, 0.25), vec3(0.98, 0.70, 0.42), g) + vec3(0.07, 0.05, 0.03) * exp(-abs(p.y - GW_VP.y) * 9.0);
}
float gwLean(float i){ return (hash11(i * 7.31 + 1.7) - 0.5) * 0.07 + (i == 2.0 ? 0.06 : 0.0); }

vec3 gwSky(vec2 p, float t){
  float h = p.y - GW_VP.y;
  vec3 c = mix(vec3(0.97, 0.70, 0.44), vec3(0.46, 0.44, 0.47), smoothstep(0.0, 0.26, h));
  c = mix(c, vec3(0.16, 0.19, 0.27), smoothstep(0.20, 0.60, h));
  float d = length((p - GW_SUN) * vec2(1.0, 1.2));
  c += vec3(1.0, 0.64, 0.34) * exp(-d * 6.0) * 0.45 + vec3(1.0, 0.84, 0.60) * exp(-d * 22.0) * 0.75;
  c += vec3(1.0, 0.82, 0.55) * smoothstep(0.022, 0.010, d) * 1.4;
  // long thin clouds catching the last of the light
  float cl = gfbm(vec2(p.x * 1.5 + t * 0.003, h * 7.0 + 3.0));
  float band = smoothstep(0.04, 0.32, cl) * smoothstep(0.04, 0.22, h);
  c = mix(c, mix(vec3(0.92, 0.56, 0.38), vec3(0.32, 0.28, 0.34), smoothstep(0.08, 0.45, h)), band * 0.5);
  return c;
}

/* the ground plane: earth and weeds, the two ballast beds and their ties */
vec3 gwGround(vec2 p, vec2 cam, float px, out float z){
  float dy = max(GW_VP.y - p.y, 1e-4);
  float eye = GW_EYE + cam.y;
  z = eye / dy;
  float X = (p.x - GW_VP.x) * z + cam.x;
  float pw = px * z;
  float pz = px * z * z / eye;
  vec2 w = vec2(X, z);
  float lod = smoothstep(0.006, 0.06, max(pw, pz * 0.5));
  float n = vnoise(w * vec2(0.8, 0.30)) * 2.0 - 1.0;
  float n2 = (vnoise(w * vec2(3.0, 1.2) + 7.0) * 2.0 - 1.0) * (1.0 - lod * 0.7);
  vec3 c = mix(vec3(0.060, 0.075, 0.045), vec3(0.14, 0.15, 0.075), smoothstep(-0.4, 0.5, n + 0.4 * n2));
  float e0 = abs(X - GW_X0) - 1.85 - 0.25 * (vnoise(w * vec2(0.9, 0.25)) * 2.0 - 1.0);
  float e1 = abs(X - GW_X1) - 1.75 - 0.40 * (vnoise(w * vec2(0.9, 0.25) + 5.0) * 2.0 - 1.0);
  float st = (gnoise(w * 16.0) + 0.5 * gnoise(w * 37.0 + 3.0)) * (1.0 - lod);
  vec3 bal = vec3(0.25, 0.235, 0.215) * (0.86 + 0.55 * st);
  float ru = min(abs(abs(X - GW_X0) - GW_HG), abs(abs(X - GW_X1) - GW_HG));
  bal = mix(bal, vec3(0.22, 0.13, 0.08), 0.45 * exp(-ru * ru * 9.0));
  float bedA = af(e0, pw * 2.0 + 0.02);
  float bedB = af(e1, pw * 2.0 + 0.02);
  c = mix(c, bal, bedA);
  c = mix(c, bal * vec3(0.90, 0.94, 0.86), bedB);
  // weeds pushing through, thickest on the forgotten siding
  float wd = (vnoise(w * vec2(1.6, 0.6) + 11.0) * 2.0 - 1.0) * 0.8 + 0.4 * (vnoise(w * vec2(5.0, 2.0)) * 2.0 - 1.0) * (1.0 - lod);
  float weeds = smoothstep(0.10, 0.50, wd + 0.40 * bedB - 0.25 * bedA + 0.5 * (1.0 - max(bedA, bedB)));
  c = mix(c, vec3(0.085, 0.115, 0.050) * (0.75 + 0.6 * (n2 * 0.5 + 0.5)), weeds * 0.9);
  // low sun from the far end: the open cut lies in light, the woods and the boxcar throw long shadows toward us
  float lit = smoothstep(GW_LEFT + 1.2, GW_LEFT + 3.4, X) * smoothstep(GW_RIGHT - 0.3, GW_RIGHT - 2.0, X);
  lit *= 0.55 + 0.45 * smoothstep(0.30, 0.70, n1(z * 0.12 + X * 0.25 + 3.0));
  float carSh = smoothstep(0.35, -0.35, abs(X - GW_X1) - 1.55) * smoothstep(GW_ZB1 + 0.5, GW_ZB1 - 1.0, z);
  lit *= 1.0 - 0.85 * carSh;
  // the forest floor: needles and leaf litter under the trees
  float inF = max(GW_LEFT - X, X - GW_RIGHT);
  c = mix(c, vec3(0.055, 0.045, 0.032) * (0.8 + 0.4 * n2), smoothstep(-0.5, 1.5, inF));
  // ties
  for (int L = 0; L < 2; L++){
    float xc = L == 0 ? GW_X0 : GW_X1;
    float lx = X - xc;
    if (abs(lx) > 1.6) continue;
    float zt = z / 0.62 + float(L) * 0.41;
    float ti = floor(zt);
    float h = hash11(ti * 1.71 + float(L) * 37.0);
    if (h < (L == 0 ? 0.04 : 0.16)) continue;
    float skew = (hash11(ti * 5.3 + float(L)) - 0.5) * (L == 0 ? 0.06 : 0.18);
    float dz = (fract(zt) - 0.5) * 0.62 - skew * lx;
    float tl = 1.32 + 0.10 * (hash11(ti * 3.1) - 0.5);
    float face = 0.13 * z / eye;
    float avg = smoothstep(0.10, 0.32, pz);
    float tie = af(abs(dz + face * 0.5) - 0.12 - face * 0.5, pz) * af(abs(lx) - tl, pw);
    tie = mix(tie, 0.40 * af(abs(lx) - tl, pw), avg);
    float grain = gnoise(vec2(lx * 2.5 + h * 9.0, dz * 30.0)) * (1.0 - avg);
    vec3 wood = mix(vec3(0.13, 0.10, 0.075), vec3(0.22, 0.17, 0.12), h) * (0.82 + 0.40 * grain);
    wood = mix(wood, wood * 0.5, step(dz, -0.12) * (1.0 - avg));
    if (L == 1) wood = mix(wood, vec3(0.08, 0.10, 0.05), 0.35 * weeds);
    c = mix(c, wood, tie * (1.0 - 0.6 * weeds * float(L)));
  }
  return c * (0.60 + 0.55 * lit);
}

/* the rails: heads polished by the low sun, sides rusted through */
vec4 gwRails(vec2 p, vec2 cam, float px){
  float dy = GW_VP.y - p.y;
  if (dy <= 0.0) return vec4(0.0);
  float eye = GW_EYE + cam.y;
  float dx = p.x - GW_VP.x;
  float zh = (eye - 0.28) / dy;
  float Xh = dx * zh + cam.x;
  float pwh = px * zh;
  vec3 c = vec3(0.0); float a = 0.0;
  for (int i = 0; i < 4; i++){
    float xr = (i < 2 ? GW_X0 : GW_X1) + (i % 2 == 0 ? -GW_HG : GW_HG);
    float head = af(abs(Xh - xr) - 0.036, pwh);
    float xs = xr + 0.036 * sign(cam.x - xr);
    float zs = (xs - cam.x) / dx;
    float side = 0.0;
    if (zs > 0.0){
      float gy = (p.y - GW_VP.y) * zs + cam.y + GW_EYE;
      side = af(abs(gy - 0.20) - 0.08, px * zs);
    }
    float cov = max(head, side);
    if (cov <= 0.0) continue;
    float zz = head > side ? zh : zs;
    float rpat = smoothstep(0.30, 0.70, n1(zz * 0.9 + float(i) * 13.0));
    float gleam = smoothstep(4.0, 70.0, zz) * (0.35 + 0.65 * rpat) * (i < 2 ? 1.0 : 0.45);
    vec3 hc = mix(vec3(0.30, 0.16, 0.09), vec3(1.0, 0.80, 0.56) * 1.3, gleam);
    vec3 sc = vec3(0.14, 0.07, 0.045) * (0.8 + 0.4 * rpat);
    vec3 rc = head > side ? hc : sc;
    c = mix(c, rc, cov); a = max(a, cov);
  }
  return vec4(c, a);
}

/* foliage as overlapping round clumps: x = depth inside the best clump (1 at its heart, 0 at its rim), yz = position in it */
vec3 gwClumps(vec2 w, float seed){
  vec2 ci = floor(w - 0.5);
  vec3 best = vec3(-1.0, 0.0, 0.0);
  for (int j = 0; j <= 1; j++) for (int i = 0; i <= 1; i++){
    vec2 g = ci + vec2(float(i), float(j));
    vec2 c = g + 0.25 + 0.50 * hash22(g + seed * 17.0);
    float r = 0.62 + 0.13 * hash21(g * 1.7 + seed);
    vec2 d = (w - c) / r;
    float v = 1.0 - length(d);
    if (v > best.x) best = vec3(v, d);
  }
  return best;
}

/* fog along a view ray: luminous in the open cut, then dark and close once the ray is inside the trees */
vec3 gwFogRay(vec3 c, vec2 p, float z, float gy, float bank, vec2 cam, vec3 litFog){
  float dx = p.x - GW_VP.x;
  float ze = dx < 0.0 ? (GW_LEFT - cam.x) / dx : (GW_RIGHT - cam.x) / max(dx, 1e-4);
  float zin = max(z - ze, 0.0);
  vec3 shade = vec3(0.060, 0.085, 0.075) + litFog * 0.10;
  c = mix(c, shade, 1.0 - exp(-zin * 0.085));
  return mix(c, litFog, gwFog(min(z, ze), gy, bank));
}

/* one tree of the forest wall: tall loblolly pines, or a live oak flung wide and hung with moss.
   w = (x, height above ground) in metres at the slice's depth */
void gwTree(vec2 w, float xc, float h, float pw, inout float dW, inout float wu, inout float wr, inout float leaf, inout float moss){
  float X = w.x, gy = w.y;
  float lean = (fract(h * 13.7) - 0.5) * 0.06;
  float bx = xc + lean * gy;
  if (h < 0.62){
    float Hc = 7.0 + 4.0 * fract(h * 3.3);
    float Ht = Hc + 4.5 + 3.5 * fract(h * 9.1);
    if (gy > Ht + 2.4) return;
    float r0 = 0.16 + 0.13 * fract(h * 7.1);
    float r = r0 * (1.0 - 0.40 * gy / Ht) + r0 * 0.7 * exp(-gy * 2.2);
    float dT = max(abs(X - bx) - r, gy - Ht);
    if (dT < dW){ dW = dT; wu = (X - bx) / r; wr = r; }
    if (gy > Hc - 1.8 && abs(X - bx) < 3.6){
      for (int i = 0; i < 3; i++){
        float fi = float(i);
        float hh = hash11(h * 91.0 + fi * 7.7);
        float cy = mix(Hc + 0.3, Ht - 1.2, fi * 0.5);
        float side = mod(fi + floor(h * 10.0), 2.0) * 2.0 - 1.0;
        vec2 e = vec2(bx + side * (1.5 + 0.8 * hh) * (1.0 - fi * 0.2), cy + 0.7 + 0.5 * hh);
        float db = sdSeg(w, vec2(bx, cy - 0.4), e) - 0.075 * (1.0 - fi * 0.15);
        if (db < dW){ dW = db; wu = 0.0; wr = 0.07; }
      }
      vec2 cc = vec2(bx + (hash11(h * 5.0) - 0.5) * 0.7, (Hc + Ht) * 0.5 + 0.7);
      vec2 rr = vec2(2.3 + 0.6 * fract(h * 4.4), (Ht - Hc) * 0.5 + 1.1);
      leaf = max(leaf, 1.0 - length((w - cc) / rr));
    }
  } else {
    float Hs = 2.2 + 1.2 * fract(h * 3.7);
    if (gy > Hs + 8.5) return;
    float span = 2.7 * (0.80 + 0.25 * fract(h * 2.9));
    float r0 = 0.30 + 0.20 * fract(h * 5.3);
    float r = r0 * (1.0 + 0.8 * exp(-gy * 1.6));
    float dT = max(abs(X - bx) - r, gy - Hs - 0.5);
    if (dT < dW){ dW = dT; wu = (X - bx) / r; wr = r; }
    if (gy > Hs - 0.6 && abs(X - bx) < 3.9){
      for (int i = 0; i < 3; i++){
        float fi = float(i);
        float hh = hash11(h * 31.0 + fi * 5.1);
        vec2 a = vec2(bx, Hs);
        vec2 e = vec2(bx + (fi - 1.0) * span * (0.70 + 0.25 * hh) + (hh - 0.5) * 0.6, Hs + 2.4 + 1.2 * hh - abs(fi - 1.0) * 0.9);
        vec2 m = mix(a, e, 0.45) + vec2((fi - 1.0) * 0.6, -0.45 + 0.3 * hh);
        float dl = min(sdTaper(w, a, m, r0 * 0.60, r0 * 0.40), sdTaper(w, m, e, r0 * 0.40, r0 * 0.15));
        if (dl < dW){ dW = dl; wu = 0.0; wr = r0 * 0.4; }
      }
      vec2 cc = vec2(bx, Hs + 4.0);
      vec2 rr = vec2(span + 0.8, 2.7);
      leaf = max(leaf, 1.0 - length((w - cc) / rr));
      // Spanish moss in long grey beards under the crown and the limbs
      float ux = (X - cc.x) / rr.x;
      if (abs(ux) < 1.0){
        float cb = cc.y - rr.y * sqrt(1.0 - ux * ux) * 0.62;
        if (gy < cb + 0.4){
          float len = 0.9 + 2.6 * n1(X * 1.9 + h * 40.0);
          float f = (cb - gy) / len;
          float strands = smoothstep(0.25, 0.85, vnoise(vec2(X * 11.0, gy * 0.7 + h * 9.0))) * (0.6 + 0.4 * vnoise(vec2(X * 30.0, gy * 2.0)));
          float bunch = smoothstep(0.25, 0.60, n1(X * 3.1 + h * 7.0));
          float ragged = f + 0.35 * (vnoise(vec2(X * 9.0, h)) - 0.5);
          moss = max(moss, strands * bunch * smoothstep(-0.15, 0.10, f) * (1.0 - smoothstep(0.30, 1.0, ragged)) * 0.75);
        }
      }
    }
  }
}

/* weeds in the open ground at one depth: a ragged top edge of grass blades and seed heads */
float gwWeedD(float X, float gy, float z, float k){
  if (gy > 1.2 || z > 40.0) return 1e5;
  float e0 = abs(X - GW_X0) - 1.85, e1 = abs(X - GW_X1) - 1.75;
  float open = smoothstep(-0.3, 0.5, min(e0, e1)) + 0.55 * smoothstep(0.2, -0.6, e1) * smoothstep(-1.2, -0.4, e1 + 0.2 * sin(X * 3.0 + k));
  if (open < 0.01) return 1e5;
  float hg = (0.10 + 0.45 * fbm1lo(X * 1.4 + k * 5.0)) * open;
  hg += 0.30 * pow(n1(X * 34.0 + k * 2.3), 5.0) * open + 0.16 * pow(n1(X * 61.0 + k), 3.0) * open;
  return max(gy - hg, -gy);
}
vec4 gwWeedLayer(vec2 p, float z, float k, vec2 cam, float px, float bank, vec3 litFog){
  float gy = (p.y - GW_VP.y) * z + cam.y + GW_EYE;
  float pw = px * z;
  if (gy < -pw || gy > 1.2) return vec4(0.0);
  float X = (p.x - GW_VP.x) * z + cam.x;
  float dG = gwWeedD(X, gy, z, k);
  float cG = af(dG, pw);
  if (cG <= 0.0) return vec4(0.0);
  vec3 gc = vec3(0.060, 0.075, 0.035) * (0.8 + 0.4 * n1(X * 9.0)) + vec3(0.70, 0.62, 0.30) * exp(-abs(dG) / max(pw * 1.5, 0.02)) * 0.25 * exp(-z * 0.03);
  return vec4(gwFogRay(gc, p, z, gy, bank, cam, litFog), cG);
}

/* one slice of the world at depth z: the forest walls, the scrub at their feet and the weeds in the open.
   returns colour (fogged) and coverage */
vec4 gwSlice(vec2 p, float z, float k, vec2 cam, float px, float t, float bank, vec3 litFog){
  float gy = (p.y - GW_VP.y) * z + cam.y + GW_EYE;
  float pw = px * z;
  if (gy < -pw || gy > 21.0) return vec4(0.0);
  float X = (p.x - GW_VP.x) * z + cam.x;
  vec2 w = vec2(X, gy);
  float jit = 1.4 * (n1(z * 0.31 + k * 3.7) - 0.5);
  float inside = max((GW_LEFT + jit) - X, X - (GW_RIGHT - jit));
  float dW = 1e5, wu = 0.0, wr = 0.2, leaf = -1e5, moss = 0.0;
  if (inside > -4.0){
    float CW = 2.6;
    float xs = X + k * 1.37;
    float ci = floor(xs / CW);
    for (int j = -1; j <= 1; j++){
      float id = ci + float(j);
      float h = hash11(id * 3.17 + k * 11.3);
      float xc = (id + 0.20 + 0.60 * hash11(id * 7.1 + k * 5.9)) * CW - k * 1.37;
      float ins = max((GW_LEFT + jit) - xc, xc - (GW_RIGHT - jit));
      if (ins < 0.3 || hash11(id * 1.9 + k) < 0.10) continue;
      gwTree(w, xc, h, pw, dW, wu, wr, leaf, moss);
    }
  }
  // the understorey: young hardwoods and vines choking the edge of the trees
  if (inside > -1.2 && gy < 8.5){
    float prof = smoothstep(0.3, 2.2, gy) * smoothstep(8.5, 3.5, gy);
    leaf = max(leaf, prof * smoothstep(-1.2, 2.5, inside) * (0.35 + 0.85 * n1(X * 0.30 + k * 5.0)) - 0.25);
  }
  // clumped foliage over the whole envelope: round masses at the edge, leaf clusters on them up close
  float leafD = 1e5; vec2 lq = vec2(0.0);
  if (leaf > -0.30){
    vec3 C = gwClumps(w * vec2(1.55, 1.85) + k * 7.1, k);
    float F = min(C.x - 0.42 + 2.2 * leaf, leaf + 0.12);
    if (pw < 0.04 && F > -0.22) F += 0.24 * (gwClumps(w * 4.6 + k * 3.3, k + 9.0).x - 0.10) * smoothstep(-0.22, 0.05, F);
    leafD = -F / 2.2;
    lq = C.yz;
  }
  // scrub at the feet of the trees: palmetto and fern, ragged against the light
  float dU = 1e5;
  if (gy < 3.2 && inside > -1.5){
    float hu = (0.35 + 1.5 * fbm1lo(X * 0.60 + k * 13.0)) * smoothstep(-1.5, 1.5, inside);
    hu += 0.50 * pow(n1(X * 7.5 + k * 3.1), 4.0) * smoothstep(-0.5, 1.0, inside);
    hu += 0.22 * pow(n1(X * 23.0 + k * 1.3 + 0.2 * sin(t * 0.6 + X)), 3.0);
    dU = max(gy - hu, -gy);
  }
  // weeds and grass in the open ground, thick on the forgotten siding
  float dG = gwWeedD(X, gy, z, k);
  float cW = af(dW, pw), cL = af(leafD, pw), cU = af(dU, pw), cG = af(dG, pw);
  float cM = moss * (1.0 - cL);
  if (max(max(cW, cL), max(max(cU, cG), cM)) <= 0.0) return vec4(0.0);
  float toward = X < GW_X0 ? 1.0 : -1.0;
  float near = exp(-z * 0.030);
  vec3 sunC = vec3(1.0, 0.70, 0.42);
  // wood: bark ridges, a lit edge toward the light, moss climbing the base
  float bark = gnoise(vec2(wu * 2.3 + k * 3.0, gy * 1.4)) * step(pw, 0.08);
  vec3 c = vec3(0.075, 0.060, 0.050) * (0.80 + 0.40 * bark);
  c = mix(c, vec3(0.07, 0.09, 0.05), smoothstep(1.6, 0.2, gy) * 0.6 * step(0.12, wr));
  c += sunC * smoothstep(0.40, 1.0, wu * toward) * 0.65 * near * step(0.1, wr);
  // layers within the slice composite over each other (premultiplied), so edges never pick up a colour that isn't there
  vec3 rc = c * cW; float ra = cW;
  // leaves: dark inside the masses, glowing where light slips through at the edges
  // each clump is lit from above by the sky, and catches the cut's light on the side that faces it
  float openSide = exp(-max(inside, 0.0) * 0.40);
  float rimL = smoothstep(0.12, 0.0, -leafD);
  vec3 lc = vec3(0.030, 0.047, 0.030) * (0.72 + 0.55 * vnoise(w * 0.40 + k * 4.0));
  lc += vec3(0.06, 0.08, 0.09) * smoothstep(2.0, 12.0, gy) * 0.22 * (0.6 + 0.4 * rimL);
  lc += vec3(0.62, 0.56, 0.28) * smoothstep(0.35, 0.95, lq.x * toward) * rimL * near * openSide * 0.40;
  rc = lc * cL + rc * (1.0 - cL); ra = cL + ra * (1.0 - cL);
  vec3 mc = vec3(0.26, 0.29, 0.24) * (0.75 + 0.35 * vnoise(vec2(X * 9.0, gy))) + sunC * 0.12 * near;
  rc = mc * cM + rc * (1.0 - cM); ra = cM + ra * (1.0 - cM);
  vec3 uc = vec3(0.028, 0.044, 0.026) + vec3(0.50, 0.58, 0.25) * exp(-abs(dU) / max(pw * 1.5, 0.03)) * 0.30 * near;
  rc = uc * cU + rc * (1.0 - cU); ra = cU + ra * (1.0 - cU);
  vec3 gc = vec3(0.060, 0.075, 0.035) * (0.8 + 0.4 * n1(X * 9.0)) + vec3(0.70, 0.62, 0.30) * exp(-abs(dG) / max(pw * 1.5, 0.02)) * 0.25 * near;
  rc = gc * cG + rc * (1.0 - cG); ra = cG + ra * (1.0 - cG);
  c = gwFogRay(rc / max(ra, 1e-4), p, z, gy, bank, cam, litFog);
  return vec4(c, ra);
}

float gwCrow(vec2 q, float face, float t, float seed){
  q.x *= face;
  float bob = 0.010 * sin(t * 1.3 + seed * 6.0);
  float look = step(0.7, fract(t * 0.11 + seed));
  float d = sdEllipse(rot2(-0.35) * (q - vec2(0.0, 0.14)), vec2(0.135, 0.07));
  vec2 hq = q - vec2(0.10, 0.225 + bob);
  d = min(d, length(hq) - 0.050);
  float bk = mix(1.0, -1.0, look);
  d = min(d, sdTri(q, vec2(0.10 + 0.035 * bk, 0.245 + bob), vec2(0.10 + 0.115 * bk, 0.225 + bob), vec2(0.10 + 0.035 * bk, 0.207 + bob)));
  d = min(d, sdTaper(q, vec2(-0.09, 0.10), vec2(-0.27, 0.035), 0.040, 0.016));
  d = min(d, sdSeg(q, vec2(0.01, 0.08), vec2(0.0, 0.0)) - 0.008);
  d = min(d, sdSeg(q, vec2(0.05, 0.08), vec2(0.045, 0.0)) - 0.008);
  return d;
}

/* boxcar side, in its own plane: q = (distance along the car, height above the ground) */
vec3 gwCarSide(vec2 q, float pz, float pg){
  float u = q.x - GW_ZB0, v = q.y;
  vec3 paint = vec3(0.34, 0.12, 0.075);
  float rn = fbm3(vec2(u * 0.55, v * 0.9) + 3.0) * 1.6 - 0.75;
  float rust = smoothstep(-0.05, 0.35, rn + 0.30 * smoothstep(2.1, 1.3, v));
  vec3 c = mix(paint, vec3(0.27, 0.15, 0.07), rust * 0.75);
  c *= 0.82 + 0.28 * gnoise(vec2(u * 8.0, v * 0.35));
  // panel ribs, each with a hairline of light on its far side
  float lodR = smoothstep(0.25, 0.6, pz);
  float ru = fract((u - 0.30) / 1.04) * 1.04;
  float rib = af(abs(ru - 0.05) - 0.05, pz);
  c = mix(c, c * 0.6, rib * (1.0 - lodR));
  c += vec3(1.0, 0.65, 0.38) * af(abs(ru - 0.12) - 0.012, pz) * 0.25 * (1.0 - lodR);
  // the door, slid half open: a black gap behind it
  float doorL = 6.0, doorR = 8.6;
  float inDoorV = step(1.35, v) * step(v, 4.0);
  if (u > doorL - 2.3 && u < doorR + 0.2){
    float panel = af(max(abs(u - (doorL - 0.9)) - 1.45, abs(v - 2.67) - 1.33), pz);
    vec3 dc = mix(vec3(0.30, 0.12, 0.07), vec3(0.24, 0.14, 0.07), rust) * (0.85 + 0.25 * gnoise(vec2(u * 3.0, v * 0.6)));
    dc = mix(dc, dc * 0.55, af(abs(fract((u - doorL + 2.35) / 0.48) * 0.48 - 0.04) - 0.03, pz) * (1.0 - lodR));
    float gap = step(doorL + 0.55, u) * step(u, doorR) * inDoorV;
    c = mix(c, vec3(0.012, 0.010, 0.010) + vec3(0.12, 0.08, 0.05) * smoothstep(1.3, 4.0, v) * 0.3, gap);
    c = mix(c, dc, panel);
    c = mix(c, vec3(0.06, 0.05, 0.045), af(abs(v - 4.06) - 0.05, pg) * step(doorL - 2.4, u) * step(u, doorR + 0.1));
  }
  // faded stencil lettering
  float letters = step(0.5, hash11(floor(u / 0.26) + 3.0)) * af(abs(fract(u / 0.26) - 0.5) - 0.38, pz / 0.26);
  float l1 = letters * af(abs(v - 3.45) - 0.17, pg) * step(1.0, u) * step(u, 3.6);
  float l2 = step(0.4, hash11(floor(u / 0.14) + 9.0)) * af(abs(v - 2.30) - 0.06, pg) * step(9.4, u) * step(u, 11.6);
  c = mix(c, vec3(0.62, 0.58, 0.50), (l1 * 0.55 + l2 * 0.4) * (1.0 - rust * 0.6) * (1.0 - lodR * 0.5));
  // the roof's edge, the sill and its rust drips
  c = mix(c, vec3(0.42, 0.25, 0.16), af(abs(v - 4.22) - 0.05, pg) * 0.6);
  c = mix(c, vec3(0.08, 0.05, 0.04), af(abs(v - 1.30) - 0.06, pg));
  return c;
}

/* boxcar end, facing us in shadow: q = (X across, height above the ground) */
vec3 gwCarEnd(vec2 q, float pw, float t){
  float u = q.x - (GW_X1 - 1.55), v = q.y;
  vec3 c = vec3(0.155, 0.072, 0.052);
  float rn = fbm3(vec2(u * 0.9, v * 0.9) + 8.0) * 1.6 - 0.75;
  c = mix(c, vec3(0.15, 0.085, 0.045), smoothstep(-0.05, 0.35, rn) * 0.8);
  c *= 0.82 + 0.30 * gnoise(vec2(u * 9.0, v * 0.4));
  // rust running down from every seam
  c = mix(c, vec3(0.20, 0.10, 0.04), smoothstep(0.2, 0.7, gnoise(vec2(u * 14.0, v * 1.2 + 3.0))) * 0.35);
  // shallow corrugations: tops catch a little sky
  float cv = fract((v - 1.35) / 0.42);
  float inset = smoothstep(0.08, 0.20, u) * smoothstep(0.08, 0.20, 3.1 - u) * step(1.4, v) * step(v, 4.05);
  c *= 1.0 - 0.18 * smoothstep(0.55, 0.95, cv) * inset;
  c += vec3(0.20, 0.24, 0.28) * smoothstep(0.30, 0.10, abs(cv - 0.25)) * inset * 0.05;
  c *= vec3(0.86, 0.92, 1.0);
  // corner posts
  c = mix(c, c * 0.65, af(min(abs(u - 0.07), abs(u - 3.03)) - 0.06, pw));
  // ladder on the right
  float rungs = af(abs(fract((v - 1.5) / 0.46) * 0.46 - 0.23) - 0.022, pw) * step(2.45, u) * step(u, 2.95) * step(1.4, v) * step(v, 4.0);
  float stile = af(min(abs(u - 2.47), abs(u - 2.93)) - 0.025, pw) * step(1.4, v) * step(v, 4.05);
  c = mix(c, vec3(0.05, 0.035, 0.03), max(rungs, stile));
  // brake wheel and staff, top left
  vec2 bw = vec2(u - 0.95, v - 3.70);
  float ring = abs(length(bw) - 0.30) - 0.025;
  float sp = abs(sin(atan(bw.y, bw.x) * 3.0)) * length(bw) - 0.02;
  float wheel = min(ring, max(sp, length(bw) - 0.30));
  wheel = min(wheel, max(abs(u - 0.95) - 0.025, max(v - 3.70, 1.6 - v)));
  c = mix(c, vec3(0.04, 0.03, 0.028), af(wheel, pw));
  c += vec3(0.9, 0.6, 0.4) * exp(-abs(ring) / (pw * 1.5)) * step(bw.x + bw.y, 0.0) * 0.06;
  // roof lip
  c = mix(c, vec3(0.34, 0.22, 0.15), af(abs(v - 4.22) - 0.05, pw) * 0.7);
  return c;
}

/* the near-side trucks and the coupler: q = (z, height) in the wheel plane */
/* the trucks in one wheel plane: q = (z, height), kz = how much the plane is foreshortened on screen.
   returns distance (in squashed units) and a shade term */
vec2 gwTruck(vec2 q, float kz){
  float d = 1e5, sh = 0.0;
  for (int i = 0; i < 2; i++){
    float zc = i == 0 ? GW_ZB0 + 1.9 : GW_ZB1 - 1.9;
    if (abs(q.x - zc) > 1.8) continue;
    vec2 lq = vec2((q.x - zc) * kz, q.y);
    float frame = sdBox(lq - vec2(0.0, 0.80), vec2(1.15 * kz, 0.13));
    frame = min(frame, sdBox(lq - vec2(0.0, 1.02), vec2(0.38 * kz, 0.20)));
    for (int a = 0; a < 2; a++){
      vec2 wq = lq - vec2((float(a) - 0.5) * 1.75 * kz, 0.70);
      float wd = sdEllipse(wq, vec2(0.42 * kz, 0.42));
      if (wd < d){ d = wd; sh = 0.55 + 0.45 * smoothstep(0.30, 0.42, length(wq / vec2(kz, 1.0))) - 0.25 * step(length(wq / vec2(kz, 1.0)), 0.12); }
    }
    if (frame < d){ d = frame; sh = 0.75 + 0.25 * smoothstep(0.80, 0.93, q.y); }
  }
  return vec2(d, sh);
}

float gwSignalD(vec2 q){
  float d = max(abs(q.x) - 0.075, max(-q.y, q.y - 4.6));
  d = min(d, sdBox(q - vec2(0.0, 4.75), vec2(0.27, 0.55)));
  for (int i = 0; i < 3; i++){
    vec2 lq = q - vec2(0.0, 5.08 - float(i) * 0.33);
    d = min(d, max(abs(length(lq) - 0.13) - 0.025, -lq.y - 0.02));
  }
  d = min(d, sdBox(q - vec2(0.0, 0.25), vec2(0.30, 0.25)));
  return d;
}

float gwFigure(vec2 q, float t){
  float sw = 0.035 * sin(t * 0.45);
  q.x -= sw * q.y;
  float d = length(q - vec2(0.03, 1.60)) - 0.105;
  d = min(d, sdTaper(q, vec2(0.0, 1.42), vec2(0.0, 0.95), 0.20, 0.15));
  d = min(d, sdTaper(q, vec2(-0.19, 1.38), vec2(-0.22, 0.80), 0.055, 0.045));
  d = min(d, sdTaper(q, vec2(0.19, 1.38), vec2(0.26, 0.86), 0.055, 0.045));
  d = min(d, sdTaper(q, vec2(-0.08, 0.95), vec2(-0.11, 0.0), 0.075, 0.055));
  d = min(d, sdTaper(q, vec2(0.08, 0.95), vec2(0.14, 0.02), 0.075, 0.055));
  return d;
}

/* a loblolly pom-pom: long needles radiating from a twig's end */
float gwNeedleTuft(vec2 q, float R, float seed){
  float r = length(q);
  if (r > R * 1.05) return r - R;
  q.y += 0.22 * R * (r / R) * (r / R);
  float a = atan(q.y, q.x);
  float st = 6.2831853 / 96.0;
  float id = floor(a / st + 0.5);
  float ac = id * st + 0.05 * (hash11(id + seed) - 0.5);
  vec2 dir = vec2(cos(ac), sin(ac));
  float along = dot(q, dir);
  float L = R * (0.58 + 0.42 * hash11(id * 1.3 + seed));
  float dl = abs(dot(q, vec2(-dir.y, dir.x))) - 0.0009 - 0.014 * R * max(1.0 - along / L, 0.0);
  float core = length(q * vec2(1.0, 1.2)) - R * (0.44 + 0.08 * sin(a * 5.0 + seed) + 0.05 * sin(a * 11.0 + seed * 2.0));
  return min(max(dl, along - L), core);
}

/* the live oak's trunk at the right edge; tc = (across the trunk -1..1, height) */
float gwOakTrunkD(vec2 q, out vec2 tc){
  float tx = 0.85 - 0.03 * q.y + 0.022 * sin(q.y * 3.1 + 0.5) + 0.010 * sin(q.y * 8.3 + 2.0);
  float tw = 0.150 + 0.080 * smoothstep(-0.16, -0.52, q.y) + 0.012 * sin(q.y * 9.0 + 1.0) + 0.012 * (fbm1lo(q.y * 6.0) - 0.5);
  tc = vec2((q.x - tx) / tw, q.y);
  return abs(q.x - tx) - tw;
}
/* its great limb: s runs from the trunk (0) out past the top of the frame (1) */
float gwLimbS(float x){ return clamp((0.72 - x) / 0.80, -0.05, 1.2); }
float gwLimbY(float s){ return mix(0.215, 0.60, pow(max(s, 0.0), 1.35)) - 0.045 * sin(s * 3.14159) + 0.010 * sin(s * 13.0); }
float gwLimbW(float s){ return mix(0.082, 0.020, clamp(s, 0.0, 1.0)) + 0.006 * sin(s * 31.0) + 0.004 * sin(s * 57.0 + 1.0); }
/* (centre height, half thickness, s along it) for either limb */
vec3 gwLimb(float x, float id){
  if (id < 0.5){ float s = gwLimbS(x); return vec3(gwLimbY(s), gwLimbW(s), s); }
  float s = clamp((x + 0.88) / 0.60, -0.05, 1.3);
  float y = mix(0.395, 0.62, pow(max(s, 0.0), 1.7)) - 0.035 * sin(s * 3.14159) + 0.008 * sin(s * 11.0 + 2.0);
  float w = mix(0.058, 0.017, clamp(s, 0.0, 1.0)) + 0.005 * sin(s * 27.0 + 1.0);
  return vec3(y, w, s);
}

/* Spanish moss under the limb: beards of fine wavy fibres, densest at the top. returns coverage and depth down the beard */
vec2 gwMoss(vec2 q, float t, float limb){
  float cell = 0.021;
  float ci = floor(q.x / cell);
  float cov = 0.0, ff = 0.0;
  for (int j = -1; j <= 1; j++){
    float id = ci + float(j);
    float h = hash11(id * 1.91 + 4.0 + limb * 17.0);
    float xb = (id + 0.2 + 0.6 * hash11(id * 3.7 + limb)) * cell;
    vec3 lb = gwLimb(xb, limb);
    float s = lb.z;
    if (s <= 0.03 || s > (limb < 0.5 ? 0.92 : 0.85)) continue;
    float top = lb.x - lb.y * 0.7;
    float L = (0.06 + 0.30 * h * h) * smoothstep(0.03, 0.22, s) * (0.65 + 0.35 * sin(s * 6.0 + 0.4 + limb * 2.0)) * (limb < 0.5 ? 1.0 : 0.80);
    float fy = top - q.y;
    float f = fy / L;
    if (f < -0.05 || f > 1.0) continue;
    float sway = (0.010 * sin(t * 0.7 + id * 1.3) + 0.004 * sin(t * 1.9 + id)) * f * f;
    float W = (0.008 + 0.012 * hash11(id * 5.3)) * (1.0 - 0.45 * f);
    float lx = q.x - xb - sway;
    if (abs(lx) > W * 1.4) continue;
    float fc = 0.0017;
    float fi = floor(lx / fc);
    float fib = 0.0;
    for (int k = -1; k <= 1; k++){
      float fid = fi + float(k);
      float fh = hash11(fid * 7.13 + id * 3.1);
      float fx = (fid + 0.5) * fc + 0.0024 * sin(q.y * 70.0 + fh * 6.28) + 0.0011 * sin(q.y * 190.0 + fh * 20.0);
      float rel = clamp(abs(fid * fc) / W, 0.0, 1.0);
      float flen = L * (0.30 + 0.70 * fh) * (1.0 - 0.65 * rel * rel);
      if (fy > flen || fy < -0.01) continue;
      float wfib = 0.00050 + 0.00065 * (1.0 - fy / max(flen, 1e-3));
      fib = max(fib, smoothstep(wfib + 0.0009, wfib * 0.3, abs(lx - fx)));
    }
    float body = smoothstep(W, W * 0.15, abs(lx)) * smoothstep(0.55, 0.0, f) * 0.6;
    float c = max(fib, body) * smoothstep(-0.05, 0.02, f);
    if (c > cov){ cov = c; ff = f; }
  }
  return vec2(cov, ff);
}

/* one palmetto fan: stiff blades spread from the end of its stalk; q.y up, R its radius */
float gwFan(vec2 q, float R, float tilt, float seed){
  q = rot2(tilt) * q;
  float r = length(q);
  if (r > R * 1.05) return r - R;
  float a = atan(q.x, q.y);
  float span = 2.6;
  float n = 15.0;
  float ca = span / n;
  float id = clamp(floor((a + span * 0.5) / ca), 0.0, n - 1.0);
  float ac = -span * 0.5 + (id + 0.5) * ca;
  vec2 dir = vec2(sin(ac), cos(ac));
  float along = dot(q, dir);
  float across = abs(dot(q, vec2(dir.y, -dir.x)));
  float L = R * (0.80 + 0.20 * hash11(id + seed));
  float w = R * 0.050 * smoothstep(L, L * 0.30, along) + R * 0.006 + R * 0.05 * smoothstep(R * 0.45, R * 0.10, along);
  float d = max(across - w, max(along - L, -along));
  d = min(d, max(r - R * 0.36, -q.y + R * 0.02));
  return d;
}
float gwPalmetto(vec2 q, float S, float seed, float t){
  if (abs(q.x) > S * 1.2 || q.y > S * 1.3) return 1.0;
  float d = 1e5;
  for (int i = 0; i < 4; i++){
    float fi = float(i) - 1.5;
    float hh = hash11(seed * 7.0 + fi * 3.3);
    float tilt = fi * 0.55 + (hh - 0.5) * 0.3 + 0.03 * sin(t * 0.6 + fi + seed);
    vec2 c = vec2(fi * 0.34 * S + (hh - 0.5) * 0.1 * S, (0.50 + 0.30 * hh) * S * (1.0 - abs(fi) * 0.15));
    float R = (0.40 + 0.16 * hh) * S;
    d = min(d, gwFan(q - c, R, tilt, seed + fi));
    d = min(d, sdSeg(q, vec2(fi * 0.05 * S, 0.0), c - normalize(c) * R * 0.1) - 0.008 * S);
  }
  return d;
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 cam = uMouse * vec2(0.32, 0.16) + vec2(0.05 * sin(t * 0.07), 0.025 * sin(t * 0.05));
  float dx = p.x - GW_VP.x, sy = p.y - GW_VP.y;
  float bank = 0.55 + 0.9 * smoothstep(-0.25, 0.35, gnoise(vec2(p.x * 2.2 / max(abs(sy) * 6.0 + 0.4, 0.4) - t * 0.03, sy * 3.0 + t * 0.01)));
  vec3 fogC = gwFogCol(p);

  // ---- things standing on the line: boxcar, poles, wires, signal, crows; one layer with its own depth
  vec3 oc = vec3(0.0); float oa = 0.0; float oz = 1e5;
  // telegraph poles
  if (dx > 0.0 && sy > -0.4){
    float iEst = floor(((GW_XP - cam.x) / dx - GW_ZP0) / GW_DZP + 0.5);
    for (int ii = -1; ii <= 1; ii++){
      float fi = iEst + float(ii);
      if (fi < 0.0 || fi > 6.0) continue;
      float zi = GW_ZP0 + fi * GW_DZP;
      vec2 q = vec2(dx * zi + cam.x - GW_XP, sy * zi + cam.y + GW_EYE);
      float ln = gwLean(fi);
      vec2 r = vec2(q.x - ln * q.y, q.y);
      if (abs(r.x) > 1.3 || r.y > 8.8 || r.y < -0.2) continue;
      float pwz = px * zi;
      float d = max(abs(r.x) - 0.14 + 0.006 * r.y, max(-r.y, r.y - 8.6));
      d = min(d, sdBox(r - vec2(0.0, 8.05), vec2(1.05, 0.065)));
      d = min(d, sdBox(r - vec2(0.0, 7.35), vec2(1.05, 0.065)));
      d = min(d, sdSeg(r, vec2(-0.62, 8.0), vec2(0.0, 7.45)) - 0.03);
      d = min(d, sdSeg(r, vec2(0.62, 8.0), vec2(0.0, 7.45)) - 0.03);
      float ins = 1e5;
      for (int j = 0; j < 4; j++){
        float xj = (float(j) - 1.5) * 0.62;
        ins = min(ins, sdBox(r - vec2(xj, 8.19), vec2(0.045, 0.075)));
        ins = min(ins, sdBox(r - vec2(xj, 7.49), vec2(0.045, 0.075)));
      }
      float pc = max(af(d, pwz), af(ins, pwz));
      if (pc > 0.0 && zi < oz + 1.0){
        float grain = gnoise(vec2(r.x * 30.0, r.y * 1.5)) * step(pwz, 0.05);
        vec3 c = vec3(0.10, 0.085, 0.07) * (0.85 + 0.3 * grain);
        c += vec3(1.0, 0.68, 0.40) * smoothstep(0.04, 0.14, -r.x) * step(d, 0.0) * 0.25 * exp(-zi * 0.03);
        c = mix(c, vec3(0.45, 0.62, 0.55) + vec3(0.6, 0.45, 0.3) * 0.4, af(ins, pwz) * 0.8);
        c = mix(c, fogC, gwFog(zi, q.y, bank));
        oc = mix(oc, c, pc); oa = max(oa, pc); oz = min(oz, zi);
      }
    }
  }
  // the wires between them, sagging; crows perched on the nearest span
  if (dx > 0.002 && sy > 0.0){
    for (int j = 0; j < 8; j++){
      float xj = (float(j % 4) - 1.5) * 0.62;
      float gyj = j < 4 ? 8.26 : 7.56;
      float Xw = GW_XP + xj;
      float z0 = (Xw + 0.02 * gyj - cam.x) / dx;
      float fi = floor((z0 - GW_ZP0) / GW_DZP);
      if (fi < 0.0 || fi > 5.0) continue;
      float za = GW_ZP0 + fi * GW_DZP;
      float Xa = Xw + gwLean(fi) * gyj, Xb = Xw + gwLean(fi + 1.0) * gyj;
      float B = (Xb - Xa) / GW_DZP;
      float A = Xa - B * za;
      float z = (A - cam.x) / (dx - B);
      float s = (z - za) / GW_DZP;
      if (s < 0.0 || s > 1.0) continue;
      float sag = 0.55 + 0.30 * hash11(fi * 3.0 + float(j));
      float g = gyj - sag * 4.0 * s * (1.0 - s);
      float G = g - GW_EYE - cam.y;
      float yw = GW_VP.y + G / z;
      float dg = -sag * 4.0 * (1.0 - 2.0 * s) / GW_DZP;
      float slope = -(dg * z - G) / (A - cam.x);
      float dd = abs(p.y - yw) / sqrt(1.0 + slope * slope);
      float wcv = clamp(0.020 / z / px + 0.30, 0.0, 1.0) * smoothstep(px * 1.1, 0.0, dd);
      if (wcv > 0.0 && z < oz + 0.5){
        vec3 c = mix(vec3(0.05, 0.045, 0.04), fogC, gwFog(z, g, bank));
        oc = mix(oc, c, wcv); oa = max(oa, wcv); oz = min(oz, z);
      }
    }
    // crows on the wires of the first span
    for (int i = 0; i < 4; i++){
      float fi = float(i);
      int j = i < 2 ? 1 : (i == 2 ? 6 : 2);
      float s = i == 0 ? 0.62 : (i == 1 ? 0.68 : (i == 2 ? 0.76 : 0.88));
      float xj = (float(j % 4) - 1.5) * 0.62;
      float gyj = j < 4 ? 8.26 : 7.56;
      float za = GW_ZP0;
      float z = za + s * GW_DZP;
      float X = GW_XP + xj + mix(gwLean(0.0), gwLean(1.0), s) * gyj;
      float sag = 0.55 + 0.30 * hash11(float(j));
      float g = gyj - sag * 4.0 * s * (1.0 - s);
      vec2 c0 = GW_VP + (vec2(X, g - GW_EYE) - cam) / z;
      vec2 q = (p - c0) * z;
      if (abs(q.x) > 0.5 || abs(q.y - 0.15) > 0.4) continue;
      float d = gwCrow(q, i == 1 ? -1.0 : 1.0, t, fi * 1.7);
      float cc = af(d, px * z);
      if (cc > 0.0 && z < oz + 0.5){
        vec3 c = vec3(0.025, 0.024, 0.026) + vec3(1.0, 0.7, 0.45) * exp(-abs(d) / (px * z * 1.5)) * 0.15;
        c = mix(c, fogC, gwFog(z, g, bank));
        oc = mix(oc, c, cc); oa = max(oa, cc); oz = min(oz, z);
      }
    }
  }
  // the signal: one lamp still burning red
  vec3 glow = vec3(0.0);
  {
    float zs = 19.0;
    vec2 q = vec2(dx * zs + cam.x - 1.85, sy * zs + cam.y + GW_EYE);
    if (abs(q.x) < 0.5 && q.y < 5.5 && q.y > -0.2){
      float d = gwSignalD(q);
      float sc = af(d, px * zs);
      if (sc > 0.0 && zs < oz + 0.5){
        vec3 c = vec3(0.035, 0.032, 0.030) + vec3(1.0, 0.68, 0.40) * smoothstep(0.03, 0.08, -q.x) * step(d, 0.0) * 0.15;
        c += vec3(1.0, 0.10, 0.05) * smoothstep(0.10, 0.05, length(q - vec2(0.0, 5.08))) * (0.85 + 0.15 * sin(t * 2.3));
        c = mix(c, fogC, gwFog(zs, q.y, bank) * 0.9);
        oc = mix(oc, c, sc); oa = max(oa, sc); oz = min(oz, zs);
      }
    }
    vec2 lp = GW_VP + (vec2(1.85, 5.08 - GW_EYE) - cam) / zs;
    float ld = length(p - lp);
    glow = vec3(1.0, 0.12, 0.05) * (exp(-ld * 90.0) * 0.55 + exp(-ld * 22.0) * 0.12) * (0.9 + 0.1 * sin(t * 2.3));
  }
  // the old boxcar on the siding
  float XS = GW_X1 + 1.55, XE = GW_X1 - 1.55;
  if (dx < 0.0){
    // side
    float zsd = (XS - cam.x) / dx;
    if (zsd > GW_ZB0 && zsd < GW_ZB1){
      float gy = sy * zsd + cam.y + GW_EYE;
      float pz = px * zsd * zsd / abs(XS - cam.x);
      float pg = px * zsd;
      float sc = af(max(1.25 - gy, gy - 4.27), pg);
      // crows on the roof's edge
      float crow = 1e5;
      for (int i = 0; i < 2; i++){
        float zc = i == 0 ? 14.2 : 20.8;
        vec2 c0 = GW_VP + (vec2(XS, 4.27 - GW_EYE) - cam) / zc;
        vec2 q = (p - c0) * zc;
        if (abs(q.x) < 0.5 && q.y > -0.1 && q.y < 0.5) crow = min(crow, gwCrow(q, i == 0 ? -1.0 : 1.0, t + 3.0, float(i) + 5.0));
      }
      float ccw = af(crow, pg);
      if (sc > 0.0 || ccw > 0.0){
        vec3 c = gwCarSide(vec2(zsd, gy), pz, pg);
        c = mix(c, vec3(0.03, 0.028, 0.03), ccw);
        c = mix(c, fogC, gwFog(zsd, gy, bank));
        float cv = max(sc, ccw);
        oc = mix(oc, c, cv); oa = max(oa, cv); oz = min(oz, zsd);
      }
    }
    // end
    vec2 q = vec2(dx * GW_ZB0 + cam.x, sy * GW_ZB0 + cam.y + GW_EYE);
    if (q.x > XE - 0.1 && q.x < XS + 0.1 && q.y > 0.0 && q.y < 4.4){
      float pe = px * GW_ZB0;
      float ec = af(max(abs(q.x - GW_X1) - 1.55, max(1.25 - q.y, q.y - 4.27)), pe);
      // coupler and end sill below the body
      float cp = sdBox(q - vec2(GW_X1, 1.04), vec2(0.06, 0.10)) - 0.02;
      cp = min(cp, sdBox(q - vec2(GW_X1 + 0.04, 0.95), vec2(0.13, 0.07)) - 0.03);
      cp = min(cp, sdBox(q - vec2(GW_X1, 1.23), vec2(1.55, 0.04)));
      float ccv = af(cp, pe);
      if (ec > 0.0 || ccv > 0.0){
        vec3 c = gwCarEnd(q, pe, t);
        c = mix(c, vec3(0.03, 0.025, 0.022), ccv * (1.0 - ec));
        c = mix(c, fogC, gwFog(GW_ZB0, q.y, bank));
        float cv = max(ec, ccv);
        oc = mix(oc, c, cv); oa = max(oa, cv); oz = min(oz, GW_ZB0);
      }
    }
    // trucks: the far side's first, then the near side's in front
    for (int sd = 0; sd < 2; sd++){
      float XW = sd == 0 ? GW_X1 - GW_HG - 0.07 : GW_X1 + GW_HG + 0.07;
      float ztk = (XW - cam.x) / dx;
      if (ztk < GW_ZB0 - 0.5 || ztk > GW_ZB1 + 0.5) continue;
      float gy = sy * ztk + cam.y + GW_EYE;
      if (gy > 1.3 || gy < 0.0) continue;
      float kz = abs(XW - cam.x) / ztk;
      vec2 tr = gwTruck(vec2(ztk, gy), kz);
      float tc = af(tr.x, px * ztk);
      if (tc > 0.0 && ztk < oz + 4.0){
        vec3 c = vec3(0.030, 0.025, 0.021) * tr.y * (sd == 0 ? 0.6 : 1.0) + vec3(0.30, 0.15, 0.07) * tr.y * 0.05;
        c = mix(c, fogC, gwFog(ztk, gy, bank));
        oc = mix(oc, c, tc); oa = max(oa, tc); oz = min(oz, ztk);
      }
    }
  }
  // far down the line, something stands on the tracks
  {
    float zf = 61.0;
    vec2 q = vec2(dx * zf + cam.x - 0.15, sy * zf + cam.y + GW_EYE);
    if (abs(q.x) < 0.6 && q.y > -0.1 && q.y < 1.9){
      float fcv = af(gwFigure(q, t), px * zf) * 0.9;
      if (fcv > 0.0 && zf < oz){
        vec3 c = mix(vec3(0.03, 0.03, 0.03), fogC, gwFog(zf, 1.0, bank) * 0.92);
        oc = mix(oc, c, fcv); oa = max(oa, fcv); oz = min(oz, zf);
      }
    }
  }

  // ---- the forest, near to far, stopping once the pixel is covered
  vec3 acc = vec3(0.0); float T = 1.0; float zHit = 1e5;
  bool objPending = oa > 0.0;
  if (sy < -0.18){
    for (int e = 0; e < 4; e++){
      float ze = 3.4 * pow(1.13, float(e));
      vec4 wl = gwWeedLayer(p, ze, 20.0 + float(e) * 0.7, cam, px, bank, fogC);
      if (wl.a > 0.0){ acc += T * wl.rgb * wl.a; T *= 1.0 - wl.a; }
    }
  }
  for (int k = 0; k < 10; k++){
    float z = 5.5 * pow(1.38, float(k));
    if (objPending && oz < z){
      acc += T * oc * oa; T *= 1.0 - oa; objPending = false;
      if (oa > 0.5) zHit = min(zHit, oz);
    }
    if (T < 0.02) break;
    vec4 s = gwSlice(p, z, float(k), cam, px, t, bank, fogC);
    if (s.a > 0.0){
      acc += T * s.rgb * s.a; T *= 1.0 - s.a;
      if (s.a > 0.5) zHit = min(zHit, z);
    }
    if (z < 21.0 && sy < 0.0){
      for (int e = 1; e <= 1; e++){
        float ze = z * 1.15;
        vec4 wl = gwWeedLayer(p, ze, float(k) + 0.37 * float(e), cam, px, bank, fogC);
        if (wl.a > 0.0){ acc += T * wl.rgb * wl.a; T *= 1.0 - wl.a; }
      }
    }
  }
  if (objPending){ acc += T * oc * oa; T *= 1.0 - oa; if (oa > 0.5) zHit = min(zHit, oz); }
  vec3 bg = fogC;
  float zg = 1e5;
  if (T < 0.004){
    zg = zHit;
  } else if (sy < 0.0){
    bg = gwGround(p, cam, px, zg);
    vec4 rl = gwRails(p, cam, px);
    bg = mix(bg, rl.rgb, rl.a);
    bg = gwFogRay(bg, p, zg, 0.0, bank, cam, fogC);
  } else {
    bg = gwSky(p, t);
  }
  if (T > 0.0) zHit = min(zHit, zg);
  acc += T * bg;
  vec3 col = acc;

  // ---- light: shafts falling through the canopy toward us, the red lamp's halo, fireflies
  vec2 sd = p - GW_SUN;
  float ang = atan(sd.y, sd.x);
  float rays = smoothstep(0.45, 0.95, n1(ang * 11.0 + 4.0 + t * 0.02)) * 0.6 + smoothstep(0.55, 1.0, n1(ang * 23.0 - t * 0.035)) * 0.4;
  rays *= smoothstep(0.02, 0.18, length(sd)) * exp(-length(sd) * 1.6) * smoothstep(-0.25, 0.1, sd.y);
  float inScatter = 1.0 - exp(-max(min(zHit, 200.0) - 6.0, 0.0) * 0.022);
  float skyness = sy > 0.0 ? T : 0.0;
  col += vec3(1.0, 0.72, 0.42) * rays * inScatter * 0.22 * (1.0 - 0.65 * skyness);
  col += vec3(1.0, 0.62, 0.32) * exp(-length(sd * vec2(0.6, 1.4)) * 4.0) * inScatter * 0.12;
  col += glow * (zHit > 18.0 ? 1.0 : 0.25);
  for (int i = 0; i < 13; i++){
    float fi = float(i);
    float hx = hash11(fi * 3.7 + 0.5), hz = hash11(fi * 5.9 + 1.3), hy = hash11(fi * 2.3 + 7.1);
    float zf = 7.0 + hz * 34.0;
    float side = hx < 0.5 ? GW_LEFT + 0.5 - hx * 6.0 : GW_RIGHT - 0.5 + (hx - 0.5) * 6.0;
    vec3 wp = vec3(side + 0.6 * sin(t * 0.21 + fi * 2.0), 0.3 + hy * 2.2 + 0.3 * sin(t * 0.33 + fi), zf);
    vec2 sp = GW_VP + (wp.xy - vec2(0.0, GW_EYE) - cam) / wp.z;
    float d = length(p - sp);
    if (d > 0.05) continue;
    float blink = pow(max(0.0, sin(t * (0.5 + hy * 0.6) + fi * 2.7)), 10.0);
    float r = max(0.05 / wp.z, px * 0.8);
    float vis = step(wp.z, zHit + 1.0);
    col += vec3(0.80, 1.0, 0.35) * blink * vis * (exp(-d * d / (r * r)) * 1.2 + exp(-d / (r * 4.0)) * 0.12);
  }

  // ---- the near foreground, slightly ahead of everything else in parallax
  vec2 pf = p + uMouse * vec2(0.075, 0.035);
  // a second oak's limb reaching in from beyond the left edge, bearded with moss
  if (pf.x < -0.20 && pf.y > 0.10){
    vec3 lb = gwLimb(pf.x, 1.0);
    vec2 mo = (pf.y < lb.x + 0.02 && pf.y > lb.x - 0.40) ? gwMoss(pf, t + 1.7, 1.0) : vec2(0.0);
    if (mo.x > 0.0){
      vec3 mcol = vec3(0.34, 0.38, 0.31) * (0.75 + 0.35 * vnoise(vec2(pf.x * 300.0, pf.y * 12.0)));
      mcol += vec3(1.0, 0.76, 0.46) * 0.40 * smoothstep(0.9, 0.0, mo.y) * smoothstep(-0.85, -0.30, pf.x);
      col = mix(col, mcol, mo.x * 0.92);
    }
    float sl = (gwLimb(pf.x + 0.006, 1.0).x - gwLimb(pf.x - 0.006, 1.0).x) / 0.012;
    float dl = (abs(pf.y - lb.x) - lb.y) / sqrt(1.0 + sl * sl);
    dl = max(dl, pf.x + 0.22 - 0.30 * smoothstep(0.9, 1.3, lb.z));
    // twigs and leaves rising from it
    float dTw = 1e5; float D = -1.0;
    for (int i = 0; i < 4; i++){
      float fi = float(i);
      float xI = -0.80 + 0.13 * fi;
      vec3 l0 = gwLimb(xI, 1.0);
      vec2 o = vec2(xI, l0.x);
      float ang = (mod(fi, 2.0) * 2.0 - 1.0) * (0.30 + 0.30 * hash11(fi * 4.3 + 1.0));
      vec2 e = o + vec2(sin(ang), cos(ang)) * (0.06 + 0.05 * hash11(fi * 2.1));
      dTw = min(dTw, sdTaper(pf, o, e, 0.008, 0.003));
      D = max(D, 1.0 - length(pf - e) / (0.040 + 0.020 * hash11(fi * 6.1)));
    }
    D = max(D, 1.0 - length((pf - vec2(-0.74, 0.535)) * vec2(0.8, 1.3)) / 0.12);
    vec3 C = D > -0.25 ? gwClumps(pf * 48.0, 3.0) : vec3(-1.0, 0.0, 0.0);
    float F = min(C.x - 0.42 + 2.2 * D, D + 0.14);
    if (F > -0.25) F += 0.25 * (gwClumps(pf * 130.0, 5.0).x - 0.1) * smoothstep(-0.2, 0.05, F);
    float dLf = -F / 70.0;
    float dO = min(dl, dTw);
    float oc = af(dO, px);
    if (oc > 0.0){
      float vv = (pf.y - lb.x) / max(lb.y, 1e-3);
      float f2 = gnoise(vec2(lb.z * 50.0, vv * 2.5));
      vec3 bc = vec3(0.034, 0.031, 0.028) * (0.7 + 0.5 * smoothstep(-0.3, 0.4, f2)) * (0.55 + 0.45 * smoothstep(-1.0, 0.6, vv));
      bc += vec3(1.0, 0.70, 0.42) * smoothstep(0.55, 1.0, vv) * 0.26;
      bc = mix(bc, vec3(0.05, 0.08, 0.035), smoothstep(0.35, 0.65, gnoise(vec2(lb.z * 20.0, vv))) * smoothstep(0.2, 0.9, vv) * 0.6);
      col = mix(col, bc, oc);
    }
    vec3 lcol = vec3(0.022, 0.034, 0.022) * (0.8 + 0.3 * smoothstep(-0.8, 0.8, C.z)) + vec3(0.75, 0.66, 0.34) * smoothstep(0.004, 0.0, -dLf) * smoothstep(0.5, 0.9, C.y) * 0.18;
    col = mix(col, lcol, af(dLf, px));
  }
  // the great live oak at the right edge: its limb sweeps across the top, moss pouring from it
  if (pf.x > -0.16 && pf.y > -0.5){
    float sL = gwLimbS(pf.x);
    float yL = gwLimbY(sL), wL = gwLimbW(sL);
    // moss first: it hangs behind the limb's leading edge
    vec2 mo = (pf.y < yL + 0.02 && pf.y > yL - 0.42 && pf.x < 0.74) ? gwMoss(pf, t, 0.0) : vec2(0.0);
    if (mo.x > 0.0){
      vec3 mcol = vec3(0.36, 0.40, 0.33) * (0.75 + 0.35 * vnoise(vec2(pf.x * 300.0, pf.y * 12.0)));
      mcol += vec3(1.0, 0.76, 0.46) * 0.45 * smoothstep(0.9, 0.0, mo.y) * (0.5 + 0.5 * smoothstep(0.75, 0.10, pf.x));
      col = mix(col, mcol, mo.x * 0.92);
    }
    // leaves on twigs above the limb and a heavy mass in the corner
    float D = -1.0;
    bool leafZone = pf.y > yL - 0.02 || (pf.x > 0.35 && pf.y > 0.30);
    for (int i = 0; i < 6; i++){
      if (!leafZone) break;
      float fi = float(i);
      float sI = 0.14 + 0.13 * fi;
      float xI = 0.72 - sI * 0.80;
      vec2 o = vec2(xI, gwLimbY(sI) + gwLimbW(sI) * 0.5);
      float ang = (mod(fi, 2.0) * 2.0 - 1.0) * (0.35 + 0.35 * hash11(fi * 3.3)) ;
      vec2 e = o + vec2(sin(ang), cos(ang)) * (0.08 + 0.07 * hash11(fi * 5.1));
      D = max(D, 1.0 - length(pf - e) / (0.050 + 0.025 * hash11(fi * 2.7)));
      D = max(D, 1.0 - length(pf - mix(o, e, 0.55)) / 0.035);
    }
    D = max(D, 1.0 - length((pf - vec2(0.60, 0.53)) * vec2(0.75, 1.25)) / 0.19);
    D = max(D, 1.0 - length((pf - vec2(0.36, 0.56)) * vec2(0.9, 1.4)) / 0.12);
    vec3 C = D > -0.25 ? gwClumps(pf * 46.0, 1.0) : vec3(-1.0, 0.0, 0.0);
    float F = min(C.x - 0.42 + 2.2 * D, D + 0.14);
    if (F > -0.25) F += 0.25 * (gwClumps(pf * 125.0, 2.0).x - 0.1) * smoothstep(-0.2, 0.05, F);
    float dLf = -F / 70.0;
    float lcov = af(dLf, px);
    vec3 lcol = vec3(0.022, 0.034, 0.022) * (0.8 + 0.3 * smoothstep(-0.8, 0.8, C.z)) + vec3(0.75, 0.66, 0.34) * smoothstep(0.004, 0.0, -dLf) * smoothstep(0.5, 0.9, -C.y) * 0.18;
    // the twigs that carry them
    float dTw = 1e5;
    for (int i = 0; i < 6; i++){
      if (!leafZone) break;
      float fi = float(i);
      float sI = 0.14 + 0.13 * fi;
      vec2 o = vec2(0.72 - sI * 0.80, gwLimbY(sI));
      float ang = (mod(fi, 2.0) * 2.0 - 1.0) * (0.35 + 0.35 * hash11(fi * 3.3));
      vec2 e = o + vec2(sin(ang), cos(ang)) * (0.08 + 0.07 * hash11(fi * 5.1));
      dTw = min(dTw, sdTaper(pf, o, e, 0.010, 0.003));
    }
    // limb
    float slope = (gwLimbY(sL + 0.01) - gwLimbY(sL - 0.01)) / 0.02 / 0.80;
    float dLimb = (abs(pf.y - yL) - wL) / sqrt(1.0 + slope * slope);
    dLimb = max(dLimb, pf.x - 0.74);
    dLimb = min(dLimb, dTw);
    // trunk
    vec2 tq;
    float dT = gwOakTrunkD(pf, tq);
    float dO = min(dT, dLimb);
    float ocov = af(dO, px);
    if (ocov > 0.0){
      vec3 bc;
      if (dT < dLimb){
        // dark, deeply furrowed bark; the edge facing the cut glows
        float u = tq.x;
        float ridge = abs(sin((u * 4.5 + 0.55 * gnoise(vec2(u * 1.5, pf.y * 5.0))) * 3.14159));
        float knots = gnoise(vec2(u * 3.0, pf.y * 14.0));
        float round = sqrt(max(1.0 - u * u, 0.0));
        bc = vec3(0.034, 0.031, 0.029) * (0.60 + 0.45 * smoothstep(0.15, 0.85, ridge) + 0.15 * knots) * (0.55 + 0.45 * round);
        bc += vec3(1.0, 0.68, 0.40) * smoothstep(-0.72, -1.0, u) * (0.45 + 0.55 * smoothstep(0.2, 0.9, ridge)) * 0.40;
        bc += vec3(0.30, 0.22, 0.15) * smoothstep(0.2, -1.0, u) * smoothstep(0.5, 0.95, ridge) * 0.06;
        float fern = smoothstep(0.35, 0.62, gnoise(pf * vec2(16.0, 7.0) + 4.0)) * smoothstep(0.1, 0.45, pf.y + 0.3);
        bc = mix(bc, vec3(0.045, 0.065, 0.030) * (0.7 + 0.6 * vnoise(pf * 160.0)), fern * 0.6);
      } else {
        float vv = (pf.y - yL) / max(wL, 1e-3);
        float f2 = gnoise(vec2(sL * 60.0, vv * 2.5));
        bc = vec3(0.036, 0.032, 0.029) * (0.7 + 0.5 * smoothstep(-0.3, 0.4, f2)) * (0.55 + 0.45 * smoothstep(-1.0, 0.6, vv));
        bc += vec3(1.0, 0.70, 0.42) * smoothstep(0.55, 1.0, vv) * 0.30;
        bc += vec3(0.30, 0.34, 0.40) * smoothstep(0.75, 1.0, vv) * 0.10;
        float fern = smoothstep(0.35, 0.65, gnoise(vec2(sL * 22.0, vv)));
        bc = mix(bc, vec3(0.06, 0.09, 0.04), fern * smoothstep(0.2, 0.9, vv) * 0.7);
      }
      col = mix(col, bc, ocov);
    }
    col = mix(col, lcol, lcov);
  }
  // palmettos and tall grass in the near corners
  {
    float dP = 1e5;
    if (pf.y < -0.12){
      dP = min(dP, gwPalmetto(pf - vec2(-0.72, -0.53), 0.20, 1.0, t));
      dP = min(dP, gwPalmetto(pf - vec2(-0.55, -0.57), 0.15, 4.0, t));
      dP = min(dP, gwPalmetto(pf - vec2(0.62, -0.55), 0.17, 7.0, t));
    }
    vec3 pcol = vec3(0.020, 0.030, 0.020) + vec3(1.0, 0.74, 0.40) * exp(-abs(dP) / (px * 1.3)) * 0.12;
    col = mix(col, pcol, af(dP, px));
    float gx = pf.x;
    float cell = 0.0036;
    float ci = floor(gx / cell);
    float dg = 1e5;
    bool inCorner = pf.y < -0.30 && (pf.x < -0.20 || pf.x > 0.38);
    for (int k = -3; k <= 3; k++){
      if (!inCorner) break;
      float id = ci + float(k);
      float hh = hash11(id * 1.37);
      float xg = id * cell;
      float side = smoothstep(-0.22, -0.62, xg) + smoothstep(0.40, 0.66, xg);
      float H = (0.03 + 0.15 * hh * hh) * side * (0.8 + 0.4 * n1(xg * 30.0));
      if (H < 0.01) continue;
      float bx = (id + 0.5) * cell;
      float y = (pf.y + 0.50) / H;
      if (y < 0.0 || y > 1.0) continue;
      float bend = (hh - 0.5) * 0.9 + 0.10 * sin(t * 0.9 + id * 0.7);
      float xx = bx + bend * H * y * y;
      float w = cell * 0.26 * (1.0 - y * 0.9);
      dg = min(dg, abs(gx - xx) - w);
    }
    vec3 gc = vec3(0.024, 0.030, 0.020) + vec3(1.0, 0.72, 0.42) * exp(-abs(dg) / (px * 1.2)) * 0.12;
    col = mix(col, gc, af(dg, px));
  }

  col = filmic(col * 1.08);
  col = grade(col, vec3(0.86, 1.02, 1.04), vec3(1.07, 1.0, 0.88), 0.55);
  return col;
}`;
