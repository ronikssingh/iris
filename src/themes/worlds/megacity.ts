/* Megacity: a rain-soaked night over endless towers. Neon signs and lit windows by the million,
   traffic streaming between the spires, searchlights raking a low cloud deck, and one colossal
   arcology climbing into the cloud. We look out from a wet rooftop. */

export const megacity = /* glsl */ `
const vec3 MC_PINK = vec3(1.0, 0.22, 0.62);
const vec3 MC_CYAN = vec3(0.20, 0.85, 1.0);
const vec3 MC_AMBER = vec3(1.0, 0.62, 0.20);

vec3 mcNeon(float h){
  return h < 0.30 ? MC_PINK : h < 0.58 ? MC_CYAN : h < 0.80 ? MC_AMBER : vec3(0.55, 1.0, 0.45);
}
vec3 mcHaze(vec2 p){
  // the city's glow in the rain: magenta to the left, teal to the right, brightest low down
  vec3 c = mix(vec3(0.30, 0.10, 0.30), vec3(0.08, 0.20, 0.30), smoothstep(-0.7, 0.7, p.x));
  return c * (0.55 + 0.6 * smoothstep(0.35, -0.25, p.y));
}

/* one layer of towers. returns colour (hazed) and coverage; zl = depth factor (1 near .. far) */
vec4 mcLayer(vec2 p, float k, float t, float px, out float topY){
  float S = k < 0.5 ? 0.34 : k < 1.5 ? 0.48 : k < 2.5 ? 0.66 : k < 3.5 ? 0.92 : 1.35;
  float y0 = k < 0.5 ? -0.02 : k < 1.5 ? -0.07 : k < 2.5 ? -0.14 : k < 3.5 ? -0.24 : -0.40;
  float hr = k < 0.5 ? 0.14 : k < 1.5 ? 0.22 : k < 2.5 ? 0.32 : k < 3.5 ? 0.44 : 0.62;
  float cw = 0.058 * S;
  float xs = p.x + k * 0.37;
  float ci = floor(xs / cw);
  vec3 col = vec3(0.0); float cov = 0.0;
  topY = -1.0;
  // two candidate buildings: this cell's and the one to its right that may be wider and overlap
  for (int j = 0; j <= 1; j++){
    float id = ci - float(j);
    float h1 = hash11(id * 1.37 + k * 17.0), h2 = hash11(id * 2.71 + k * 5.0), h3 = hash11(id * 4.13 + k * 3.0);
    float bx0 = id * cw + h2 * cw * 0.25;
    float bw = cw * (0.70 + 0.85 * h3);
    float lx = xs - bx0;
    if (lx < 0.0 || lx > bw) continue;
    float top = y0 + hr * (0.25 + 0.75 * h1 * h1) * (0.6 + 0.4 * smoothstep(0.9, 0.1, abs(p.x + 0.15)));
    // setbacks: the upper part narrows; some carry a spire
    float set = top - hr * 0.10 * h2;
    float inset = bw * 0.18 * step(set, p.y);
    float spire = step(0.65, h2) * step(abs(lx - bw * 0.5), 0.0015 * S + px * 0.5) * step(p.y, top + 0.06 * S * h3) * step(top, p.y);
    float body = step(inset, lx) * step(lx, bw - inset) * step(p.y, top);
    if (body + spire <= 0.0) continue;
    // a side face turned toward us, on the side away from the centre of view
    float sideW = bw * 0.22 * clamp(abs(p.x) * 1.4, 0.15, 1.0);
    float onSide = p.x > 0.0 ? step(lx, inset + sideW) : step(bw - inset - sideW, lx);
    // windows: floors and columns, lit in irregular blocks; some towers are banded, some dark glass
    float scheme = hash11(id * 6.3 + k * 2.0);
    float fy = 0.0075 * S, fx = (scheme > 0.75 ? 0.0115 : 0.0058) * S;
    vec2 wc = vec2(lx / fx, (p.y - y0) / fy);
    vec2 wi = floor(wc), wf = fract(wc);
    float litB = h3 * 0.6 + 0.2;
    float on = step(1.0 - litB, hash21(wi + id * 13.0 + k * 7.0)) * step(0.55, vnoise(vec2(wi.y * 0.15, id * 3.0 + wi.x * 0.05) + k));
    on = max(on, step(0.92, hash21(wi * 1.3 + id)));
    float flick = 0.85 + 0.15 * step(0.5, fract(t * 0.3 + hash21(wi + 3.0)));
    float win = smoothstep(0.30, 0.18, abs(wf.x - 0.5)) * smoothstep(0.34, 0.22, abs(wf.y - 0.5));
    if (scheme > 0.75) win = smoothstep(0.42, 0.30, abs(wf.y - 0.5));                     // ribbon windows
    if (scheme < 0.12) on *= 0.25;                                                         // a dark glass tower
    vec3 wcol = mix(vec3(1.0, 0.76, 0.48), vec3(0.62, 0.84, 1.0), step(0.6, hash21(wi * 0.7 + id)));
    float edgeAA = smoothstep(0.0, 2.0, min(fx, fy) / px);
    vec3 face = vec3(0.025, 0.025, 0.040) + mcHaze(p) * 0.10;
    // a sliver of neon light along the side that faces the glow
    face += mix(MC_PINK, MC_CYAN, step(0.0, p.x)) * smoothstep(bw * 0.10, 0.0, min(lx - inset, bw - inset - lx)) * 0.10;
    vec3 c = face + wcol * on * win * flick * (0.55 + 0.35 * h1) * edgeAA + wcol * on * flick * 0.10 * (1.0 - edgeAA);
    c = mix(c, c * 0.55 + mcHaze(p) * 0.05, onSide);
    if (scheme < 0.12) c += mcHaze(p) * 0.25 * smoothstep(0.3, 0.7, fract(lx / bw * 3.0 + p.y * 4.0));
    // a neon sign on the nearer towers: a tall panel of glyphs
    if (k > 1.5 && h1 > 0.35){
      float sx = bw * (h3 > 0.5 ? 0.15 : 0.85);
      float sy = top - hr * (0.25 + 0.3 * h2);
      vec2 sq = vec2(lx - sx, p.y - sy);
      vec2 sh = vec2(0.010, 0.050) * S;
      float panel = sdBox(sq, sh);
      vec3 nc = mcNeon(hash11(id * 9.1 + k));
      float flk = step(0.08, fract(t * (0.2 + h2) + h1 * 7.0)) * (0.8 + 0.2 * sin(t * 40.0 + id));
      if (panel < 0.0){
        vec2 gq = (sq + sh) / (sh * 2.0) * vec2(3.0, 12.0);
        float glyph = step(0.45, hash21(floor(gq) + id + floor(t * 0.25 + h3) * 5.0)) * step(0.15, fract(gq.x)) * step(0.12, fract(gq.y));
        c = mix(vec3(0.03, 0.02, 0.04), nc * (1.3 + 0.5 * glyph), 0.35 + 0.65 * glyph) * flk;
      }
      c += nc * exp(-max(panel, 0.0) / (0.012 * S)) * 0.30 * flk;
    }
    if (k > 2.5 && h2 > 0.55 && bw > cw * 1.1){
      vec2 bq = vec2(lx - bw * 0.5, p.y - (top - hr * 0.12));
      vec2 bs = vec2(bw * 0.36, 0.016 * S);
      float bb = sdBox(bq, bs);
      vec3 nc = mcNeon(hash11(id * 3.9 + 1.0));
      if (bb < 0.0){
        vec2 uvb = bq / bs;
        float wave = sin(uvb.x * 6.0 - t * 2.0 + h1 * 6.0) * 0.5 + 0.5;
        float bars = step(0.5, fract(uvb.x * 4.0 + t * 0.3));
        vec3 ad = mix(nc, mcNeon(fract(hash11(id) + 0.5)), wave);
        ad *= 0.6 + 0.5 * smoothstep(0.2, 0.0, abs(uvb.y - sin(uvb.x * 3.0 + t) * 0.5));
        ad *= 0.85 + 0.15 * step(0.5, fract(p.y / px * 0.5));
        c = mix(ad * 0.9, ad * bars * 1.1, 0.3);
      }
      c += nc * exp(-max(bb, 0.0) / (0.014 * S)) * 0.25;
    }
    float zf = k < 0.5 ? 0.70 : k < 1.5 ? 0.52 : k < 2.5 ? 0.34 : k < 3.5 ? 0.18 : 0.06;
    c = mix(c, mcHaze(p), zf);
    col = c; cov = max(body, spire);
    topY = max(topY, top);
    break;
  }
  return vec4(col, cov);
}

/* the arcology: a colossal stepped tower, ring platforms, light running up its spine */
vec4 mcArcology(vec2 p, float t, float px){
  vec2 q = p - vec2(-0.20, -0.30);
  if (abs(q.x) > 0.20) return vec4(0.0);
  float y = q.y;
  float hw = 0.105 - 0.075 * smoothstep(-0.05, 0.85, y) - 0.012 * floor(max(y, 0.0) * 9.0) / 9.0;
  float d = abs(q.x) - hw;
  // ring platforms
  float rings = 1e5;
  for (int i = 0; i < 4; i++){
    float ry = 0.14 + float(i) * 0.17;
    float rhw = 0.105 - 0.075 * smoothstep(-0.05, 0.85, ry) + 0.035;
    rings = min(rings, sdBox(q - vec2(0.0, ry), vec2(rhw, 0.006)));
  }
  float dd = min(d, rings);
  if (dd > px * 3.0 && abs(q.x) > 0.01) return vec4(0.0);
  vec3 c = vec3(0.03, 0.03, 0.05) + mcHaze(p) * 0.12;
  // tiny lights in rows, a spine of light pulsing upward, ring rims glowing
  vec2 lq = vec2(q.x / 0.004, y / 0.006);
  float li = step(0.70, hash21(floor(lq))) * smoothstep(0.35, 0.1, length(fract(lq) - 0.5));
  c += mix(vec3(1.0, 0.8, 0.55), vec3(0.6, 0.85, 1.0), step(0.5, hash21(floor(lq) + 1.0))) * li * 0.6;
  float spine = smoothstep(0.004, 0.0, abs(q.x)) * (0.5 + 0.8 * smoothstep(0.8, 1.0, sin(y * 30.0 - t * 3.0) * 0.5 + 0.5));
  c += MC_CYAN * spine;
  c = mix(c, MC_PINK * 0.9 + vec3(0.2), smoothstep(0.004, 0.0, abs(rings)) * 0.8);
  c = mix(c, mcHaze(p), 0.40);
  float cov = af(dd, px);
  return vec4(c + MC_CYAN * spine * 0.5, max(cov, spine * step(abs(q.x), 0.01) * step(0.0, y)));
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;

  // the night sky is a low cloud deck, lit from beneath by the city
  vec2 p0 = p + m * vec2(0.004, 0.003);
  vec3 col = mix(vec3(0.12, 0.05, 0.14), vec3(0.03, 0.03, 0.07), smoothstep(-0.1, 0.5, p0.y));
  vec2 cq = vec2(p0.x * 1.6 - t * 0.010, p0.y * 3.2);
  float cd = fbm4(cq + fbm3(cq * 1.5 + t * 0.01) * 0.8);
  vec3 under = mcHaze(p0) * 1.4;
  col = mix(col, under * (0.4 + 0.8 * cd), smoothstep(0.35, 0.75, cd) * smoothstep(0.02, 0.25, p0.y));
  // searchlights raking the cloud
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    vec2 o = vec2(-0.55 + fi * 0.62, -0.18 + 0.05 * fi);
    float ang = 1.5708 + 0.45 * sin(t * (0.13 + 0.05 * fi) + fi * 2.1);
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 rq = p0 - o;
    float along = dot(rq, dir);
    float across = abs(dot(rq, vec2(-dir.y, dir.x)));
    float beam = along > 0.0 ? exp(-across / (0.006 + along * 0.05)) * smoothstep(0.0, 0.1, along) * exp(-along * 0.9) : 0.0;
    col += vec3(0.75, 0.85, 1.0) * beam * 0.35 * (0.6 + 0.4 * cd);
  }

  // a hologram the size of a tower: a jellyfish of light drifting over the city, pulsing, flickering with scanlines
  {
    vec2 hc = vec2(0.40 + 0.03 * sin(t * 0.07), 0.16 + 0.015 * sin(t * 0.21));
    vec2 hq = (p0 - hc) / 0.13;
    if (abs(hq.x) < 1.4 && hq.y > -2.6 && hq.y < 1.3){
      float pulse = 0.5 + 0.5 * sin(t * 1.3);
      vec2 bq = hq * vec2(1.0 + 0.10 * pulse, 1.0 - 0.08 * pulse);
      float bell = length(bq * vec2(1.0, 1.25)) - 0.85;
      bell = max(bell, -bq.y - 0.05 - 0.06 * sin(bq.x * 18.0 + t * 2.0));
      float rim = exp(-abs(bell) * 22.0);
      float inner = smoothstep(0.0, -0.4, bell) * 0.25;
      float ribs = smoothstep(0.85, 1.0, abs(sin(atan(bq.x, bq.y + 0.4) * 8.0))) * smoothstep(0.02, -0.5, bell) * 0.4;
      float tent = 0.0;
      for (int i = 0; i < 7; i++){
        float fi = float(i) - 3.0;
        float tx = fi * 0.18 + 0.06 * sin(hq.y * 4.0 + t * 1.6 + fi);
        float ty = clamp(-hq.y, 0.0, 2.5);
        float wv = tx + 0.10 * sin(hq.y * 3.0 - t * 1.2 + fi * 1.7) * ty * 0.5;
        tent = max(tent, exp(-abs(hq.x - wv) * 60.0) * step(hq.y, 0.0) * smoothstep(2.4 - abs(fi) * 0.25, 0.0, ty));
      }
      float holo = rim * 0.9 + inner + ribs + tent * 0.55;
      float scan = 0.65 + 0.35 * step(0.5, fract(p0.y * 260.0 - t * 4.0));
      float glitch = step(0.97, fract(t * 0.37)) * step(0.5, fract(p0.y * 30.0 + t * 7.0));
      vec3 hcol = mix(MC_CYAN, MC_PINK, smoothstep(-0.8, 0.8, hq.y + 0.3 * sin(t * 0.5)));
      col += hcol * holo * scan * (0.55 - 0.3 * glitch);
    }
  }

  // towers, far to near, with the arcology standing among them and traffic streaming between
  float topY;
  for (int k = 0; k < 5; k++){
    float fk = float(k);
    vec2 pk = p + m * vec2(0.006 + 0.012 * fk, 0.003 + 0.004 * fk);
    if (k == 2){
      vec4 ar = mcArcology(pk, t, px);
      col = mix(col, ar.rgb, ar.a * (1.0 - smoothstep(0.30, 0.60, cd) * smoothstep(0.18, 0.40, pk.y)));
    }
    vec4 L = mcLayer(pk, fk, t, px, topY);
    col = mix(col, L.rgb, L.a);
    float mb = exp(-abs(pk.y - (-0.05 - 0.08 * fk)) * 18.0) * smoothstep(0.35, 0.75, fbm4(vec2(pk.x * 2.0 - t * 0.02 * (fk + 1.0), pk.y * 8.0 + fk)));
    col = mix(col, mcHaze(pk) * 1.3, mb * 0.35);
    // a lane of flying traffic after this layer
    if (k < 4){
      float laneY = (k == 0 ? 0.04 : k == 1 ? -0.02 : k == 2 ? -0.10 : -0.22) + 0.01 * sin(pk.x * 3.0 + fk);
      float S = 0.4 + 0.3 * fk;
      float dy = abs(pk.y - laneY);
      if (dy < 0.02 * S){
        for (int c2 = 0; c2 < 2; c2++){
          float dirn = c2 == 0 ? 1.0 : -1.0;
          float ly = laneY + dirn * 0.006 * S;
          float sp = (0.10 + 0.04 * fk) * dirn;
          float x = pk.x - t * sp;
          float cellW = 0.05 / S;
          float cx = floor(x / cellW);
          float hx = hash11(cx * 3.7 + fk * 11.0 + float(c2));
          if (hx < 0.20) continue;
          float carX = (cx + 0.5) * cellW + (hx - 0.5) * cellW * 0.5;
          float dx = x - carX;
          vec3 lc = dirn > 0.0 ? vec3(1.0, 0.18, 0.12) : vec3(1.0, 0.92, 0.80);
          float trail = exp(-max(-dx * dirn, 0.0) / (0.025 * S)) * step(dx * dirn, 0.002);
          float core = exp(-length(vec2(dx, pk.y - ly)) / (0.0016 * S));
          col += lc * (core * 1.8 + trail * exp(-abs(pk.y - ly) / (0.0010 * S)) * 0.55);
        }
      }
    }
  }

  // rain: long streaks drifting down and to the right, in three depths
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float scl = 70.0 - fi * 22.0;
    vec2 rq = vec2(p.x + p.y * 0.18, p.y) * scl;
    rq.y += t * (14.0 + fi * 8.0);
    vec2 rid = floor(rq);
    float hr = hash21(rid + fi * 13.0);
    if (hr > 0.35){
      vec2 rf = fract(rq) - vec2(0.5, 0.0);
      float len = 0.55 + 0.4 * hash21(rid + 3.0);
      float streak = smoothstep(0.04 + fi * 0.02, 0.0, abs(rf.x - (hr - 0.35) * 0.6 + 0.2)) * smoothstep(0.0, len, rf.y) * smoothstep(len + 0.05, len, rf.y);
      col += mix(vec3(0.55, 0.65, 0.85), mcHaze(p) * 2.5, 0.4) * streak * (0.10 + 0.08 * fi);
    }
  }

  // our rooftop: a wet parapet catching the neon, the drop to the street beyond it
  vec2 pf = p + m * vec2(0.08, 0.03);
  float ledge = -0.42 + 0.006 * sin(pf.x * 3.0);
  if (pf.y < ledge + 0.004){
    vec3 rc = vec3(0.020, 0.020, 0.028);
    float wet = smoothstep(ledge - 0.03, ledge, pf.y);
    rc += mcHaze(vec2(pf.x, 0.0)) * wet * 0.45;
    rc += mix(MC_PINK, MC_CYAN, smoothstep(-0.6, 0.6, pf.x)) * exp(-abs(pf.y - ledge) * 300.0) * 0.30;
    // puddle reflections: the towers' lights smeared in the water
    float puddle = smoothstep(0.55, 0.62, fbm4(pf * vec2(4.0, 20.0)));
    float streaks = vnoise(vec2(pf.x * 140.0, pf.y * 6.0 + t * 0.2));
    rc += mcHaze(vec2(pf.x, -0.2)) * puddle * (0.4 + 0.8 * streaks) * smoothstep(ledge - 0.02, -0.5, pf.y);
    rc += mcNeon(hash11(floor(pf.x * 30.0))) * puddle * step(0.86, streaks) * 0.3;
    col = mix(col, rc, af(pf.y - ledge, px));
  }

  col = filmic(col * 1.1);
  col = grade(col, vec3(0.90, 0.92, 1.12), vec3(1.05, 0.98, 0.95), 0.45);
  return col;
}`;
