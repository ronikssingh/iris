/* Sundown: a lone rider on a bluff, watching the sun go down over pine-dark mountains. */

export const sundown = /* glsl */ `
const vec2 SN_SUN = vec2(0.24, -0.028);
const float SN_SUNR = 0.046;
const float SN_HZ = -0.06;
const float SN_HS = 0.160;                     // horse scale (body length in screen heights)
const vec2 SN_HORSE = vec2(-0.505, -0.145 + 0.75 * 0.160);   // horse origin; hooves stand on the bluff

vec3 snSky(vec2 p, float px, bool disc){
  float h = p.y - SN_HZ;
  vec2 d = p - SN_SUN;
  float r = length(d);
  vec3 c = mix(vec3(1.00, 0.66, 0.30), vec3(0.98, 0.48, 0.30), smoothstep(0.0, 0.10, h));
  c = mix(c, vec3(0.80, 0.36, 0.34), smoothstep(0.07, 0.26, h));
  c = mix(c, vec3(0.32, 0.19, 0.36), smoothstep(0.22, 0.46, h));
  c = mix(c, vec3(0.075, 0.085, 0.21), smoothstep(0.38, 0.64, h));
  c += vec3(1.0, 0.60, 0.30) * exp(-r * 3.0) * 0.50;
  c += vec3(1.0, 0.78, 0.50) * exp(-r * 10.0) * 0.85;
  c += vec3(1.0, 0.90, 0.72) * exp(-max(r - SN_SUNR, 0.0) * 55.0) * 1.1;
  if (disc){
    float dc = af(r - SN_SUNR, px);
    c = mix(c, vec3(1.0, 0.90, 0.66) * (3.2 + 0.8 * (1.0 - r / SN_SUNR)), dc);
  }
  return c;
}
/* the warm haze that pools between the ridges */
vec3 snFog(float x){
  float near = exp(-abs(x - SN_SUN.x) * 2.6);
  return mix(vec3(0.90, 0.48, 0.38), vec3(1.0, 0.68, 0.38), near) * (0.55 + 0.75 * near);
}

/* ---- the horse and rider, in horse units (body length 1, hooves at y = -0.75), facing right ---- */
float snHorse(vec2 p, float t){
  float body = sdEllipse(p - vec2(0.0, 0.03), vec2(0.47, 0.215));
  body = smin(body, sdCircle(p - vec2(0.31, 0.045), 0.205), 0.08);
  body = smin(body, sdCircle(p - vec2(-0.31, 0.075), 0.215), 0.08);
  // the head dips and lifts now and then
  float horse = body;
  if (p.x > 0.12 && p.y > -0.12){
    float nod = 0.05 * sin(t * 0.37) * smoothstep(-0.3, 0.6, sin(t * 0.21 + 1.0)) - 0.02;
    vec2 pn = rot2(nod) * (p - vec2(0.36, 0.14)) + vec2(0.36, 0.14);
    float neck = sdTaper(pn, vec2(0.33, 0.12), vec2(0.60, 0.52), 0.18, 0.088);
    float crest = sdTaper(pn, vec2(0.24, 0.24), vec2(0.575, 0.60), 0.08, 0.058);
    crest -= 0.014 * (n1(dot(pn - vec2(0.24, 0.24), vec2(0.6, 0.8)) * 70.0) - 0.5);
    neck = smin(neck, crest, 0.05);
    float head = sdTaper(pn, vec2(0.635, 0.575), vec2(0.88, 0.33), 0.088, 0.050);
    head = smin(head, sdCircle(pn - vec2(0.655, 0.49), 0.078), 0.03);
    float ears = min(sdTri(pn, vec2(0.595, 0.625), vec2(0.588, 0.745), vec2(0.642, 0.65)), sdTri(pn, vec2(0.62, 0.625), vec2(0.626, 0.728), vec2(0.664, 0.64)));
    horse = smin(horse, neck, 0.08);
    horse = smin(horse, head, 0.04);
    horse = min(horse, ears);
  }
  // legs: near and far fore, near and far hind (one hind cocked at rest)
  float legs = 1e5;
  if (p.y < -0.02){
  legs = min(legs, sdTaper(p, vec2(0.30, -0.08), vec2(0.31, -0.40), 0.080, 0.044));
  legs = min(legs, sdTaper(p, vec2(0.31, -0.40), vec2(0.315, -0.665), 0.040, 0.031));
  legs = min(legs, sdTaper(p, vec2(0.315, -0.665), vec2(0.35, -0.745), 0.036, 0.043));
  legs = min(legs, sdTaper(p, vec2(0.37, -0.08), vec2(0.40, -0.39), 0.072, 0.042));
  legs = min(legs, sdTaper(p, vec2(0.40, -0.39), vec2(0.425, -0.665), 0.038, 0.030));
  legs = min(legs, sdTaper(p, vec2(0.425, -0.665), vec2(0.465, -0.745), 0.034, 0.041));
  legs = min(legs, sdTaper(p, vec2(-0.29, -0.02), vec2(-0.39, -0.37), 0.11, 0.052));
  legs = min(legs, sdTaper(p, vec2(-0.39, -0.37), vec2(-0.365, -0.665), 0.044, 0.031));
  legs = min(legs, sdTaper(p, vec2(-0.365, -0.665), vec2(-0.33, -0.745), 0.035, 0.043));
  legs = min(legs, sdTaper(p, vec2(-0.23, -0.04), vec2(-0.30, -0.36), 0.095, 0.048));
  legs = min(legs, sdTaper(p, vec2(-0.30, -0.36), vec2(-0.25, -0.64), 0.041, 0.030));
  legs = min(legs, sdTaper(p, vec2(-0.25, -0.64), vec2(-0.205, -0.71), 0.033, 0.036));
  horse = smin(horse, legs, 0.05);
  }
  // tail, streaming in the evening wind
  if (p.x < -0.36){
    float sway = sin(t * 1.25) * 0.55 + sin(t * 2.3 + 1.0) * 0.3;
    vec2 a0 = vec2(-0.465, 0.19), a1 = vec2(-0.57 - 0.03 * sway, 0.0), a2 = vec2(-0.62 - 0.07 * sway, -0.24), a3 = vec2(-0.62 - 0.11 * sway, -0.50);
    float tail = min(min(sdTaper(p, a0, a1, 0.052, 0.062), sdTaper(p, a1, a2, 0.062, 0.050)), sdTaper(p, a2, a3, 0.050, 0.016));
    tail -= 0.012 * (n1(p.y * 24.0 + p.x * 9.0 + t * 0.3) - 0.5);
    horse = smin(horse, tail, 0.03);
  }
  if (p.y < 0.15 || p.x > 0.32 || p.x < -0.30) return horse;
  // saddle, bedroll and a coiled rope on the horn
  float saddle = sdBox(p - vec2(0.03, 0.245), vec2(0.15, 0.03)) - 0.02;
  saddle = min(saddle, sdTaper(p, vec2(0.17, 0.27), vec2(0.20, 0.36), 0.024, 0.02));
  saddle = min(saddle, sdTaper(p, vec2(-0.12, 0.27), vec2(-0.135, 0.36), 0.032, 0.022));
  saddle = min(saddle, sdTaper(p, vec2(-0.24, 0.30), vec2(-0.13, 0.30), 0.045, 0.045));
  saddle = min(saddle, abs(length(p - vec2(0.205, 0.195)) - 0.05) - 0.012);
  horse = min(horse, saddle);
  // the rider
  float r = sdCircle(p - vec2(0.0, 0.34), 0.09);
  r = smin(r, sdTaper(p, vec2(0.0, 0.36), vec2(0.05, 0.645), 0.092, 0.112), 0.05);
  r = smin(r, sdTaper(p, vec2(0.055, 0.65), vec2(0.075, 0.73), 0.042, 0.037), 0.03);
  r = smin(r, sdCircle(p - vec2(0.08, 0.785), 0.058), 0.03);
  // hat: curled brim and a creased crown
  vec2 hp = rot2(-0.06) * (p - vec2(0.078, 0.835));
  float brim = max(abs(hp.y - 1.4 * hp.x * hp.x) - 0.010, abs(hp.x) - 0.135);
  float crown = sdBox(hp - vec2(0.0, 0.054), vec2(0.042, 0.047)) - 0.013;
  crown = max(crown, -sdCircle(hp - vec2(0.0, 0.117), 0.021));
  r = min(r, min(brim, crown));
  // arms holding the reins
  r = min(r, sdTaper(p, vec2(0.07, 0.63), vec2(0.14, 0.47), 0.046, 0.037));
  r = min(r, sdTaper(p, vec2(0.14, 0.47), vec2(0.28, 0.455), 0.035, 0.029));
  // leg in the stirrup
  r = min(r, sdTaper(p, vec2(0.02, 0.34), vec2(0.17, 0.20), 0.064, 0.048));
  r = min(r, sdTaper(p, vec2(0.17, 0.20), vec2(0.125, -0.05), 0.042, 0.036));
  r = min(r, sdTaper(p, vec2(0.115, -0.06), vec2(0.195, -0.08), 0.032, 0.024));
  // duster coat tail lifting in the wind
  float flap = 0.025 * sin(t * 2.2) + 0.012 * sin(t * 3.7 + 1.0);
  float coat = sdTri(p, vec2(-0.02, 0.48), vec2(-0.20 - flap, 0.13 + flap * 0.4), vec2(0.06, 0.17));
  coat -= 0.007 * (n1(p.x * 90.0 + t) - 0.5);
  r = min(r, coat);
  // reins, slack
  r = min(r, min(sdSeg(p, vec2(0.28, 0.455), vec2(0.56, 0.37)), sdSeg(p, vec2(0.56, 0.37), vec2(0.84, 0.36))) - 0.006);
  return min(horse, r);
}

/* tall grass: blades bending in the wind */
float snGrass(vec2 p, float ground, float t, float scale, float seed){
  float cell = scale * 0.2;
  float c = floor(p.x / cell);
  float d = 1e5;
  for (int k = -2; k <= 2; k++){
    float id = c + float(k);
    float h1 = hash11(id * 1.91 + seed);
    float bx = (id + h1) * cell;
    float bh = scale * (0.40 + 0.80 * hash11(id * 7.3 + seed));
    float y = (p.y - ground) / bh;
    if (y < 0.0 || y > 1.0) continue;
    float wind = 0.35 * sin(t * 1.4 + bx * 9.0) + 0.18 * sin(t * 2.9 + bx * 23.0) + 0.25;
    float bend = (h1 - 0.5) * 0.5 + wind;
    float x = bx + bend * bh * 0.35 * y * y;
    float w = cell * 0.17 * (1.0 - y);
    d = min(d, abs(p.x - x) - w);
  }
  return d;
}

/* one forested ridge: returns its colour and coverage; depth below the crest fades into the haze */
vec4 snRidge(vec2 p, float top, float spacing, float hMin, float hMax, float seed, vec3 near, vec3 far, float fogDepth, float px){
  if (p.y > top + hMax + px * 2.0) return vec4(0.0);
  float tr = pineRow(p, top, spacing, hMin, hMax, seed);
  float m = min(p.y - top, tr);
  if (m > px * 2.0) return vec4(0.0);
  float depth = max(top - p.y, 0.0);
  vec3 c = mix(near, snFog(p.x) * 0.80, smoothstep(0.0, fogDepth, depth) * 0.6);
  c = mix(c, far, exp(-depth * 400.0) * 0.4);
  c += vec3(1.0, 0.62, 0.35) * exp(-abs(m) * 1400.0) * exp(-abs(p.x - SN_SUN.x) * 3.0) * 0.6;
  return vec4(c, af(m, px));
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 p0 = p + m * vec2(0.004, 0.003);
  vec2 p1 = p + m * vec2(0.008, 0.004);
  vec2 p2 = p + m * vec2(0.011, 0.005);
  vec2 p3 = p + m * vec2(0.015, 0.006);
  vec2 p4 = p + m * vec2(0.020, 0.007);
  vec2 p5 = p + m * vec2(0.028, 0.010);

  // ground lines first, cheap, so hidden layers can be skipped
  float edgeX = -0.33;
  float y5 = -0.143 + 0.050 * (1.0 - smoothstep(-0.95, -0.52, p5.x)) - 0.015 * smoothstep(-0.46, edgeX, p5.x)
           - 0.44 * pow(smoothstep(edgeX - 0.004, edgeX + 0.24, p5.x), 0.65)
           + 0.007 * (ridge1(p5.x * 22.0) - 0.4) + 0.028 * (ridge1(p5.x * 16.0 + 3.0) - 0.45) * smoothstep(edgeX, edgeX + 0.04, p5.x);
  float y4 = -0.64 + 0.54 * smoothstep(0.02, 0.95, p5.x) + 0.02 * fbm1lo(p5.x * 4.0 + 1.0);
  float yE = SN_HZ - 0.33 + 0.11 * smoothstep(-0.3, 0.3, p5.x) + 0.04 * fbm1lo(p5.x * 1.8 + 19.0);
  float yD = SN_HZ - 0.120 - 0.13 * smoothstep(-0.35, 0.45, p5.x) + 0.035 * fbm1lo(p5.x * 2.2 + 13.0);
  float yC = SN_HZ - 0.105 + 0.07 * fbm1lo(p4.x * 1.5 + 9.0) - 0.04 * smoothstep(-0.2, 0.5, p4.x) + 0.03 * smoothstep(0.5, 0.9, p4.x);
  float yB = SN_HZ - 0.060 + 0.055 * fbm1lo(p3.x * 2.1 + 5.0) - 0.025 * exp(-pow((p3.x - SN_SUN.x) * 3.0, 2.0));
  float yA = SN_HZ - 0.016 + 0.045 * fbm1(p2.x * 2.6 + 1.0);
  bool hidE = p5.y < y5 - 0.003 || (p5.x > 0.04 && p5.y < y4 - 0.003);
  bool hidD = hidE || p5.y < yE - 0.003;
  bool hidC = hidD || p5.y < yD - 0.003;
  bool hidB = hidC || p4.y < yC - 0.003;
  bool hidA = hidB || p3.y < yB - 0.003;
  bool hidSky = hidA || p2.y < yA - 0.003;

  vec2 ds = p0 - SN_SUN;
  float rs = length(ds);
  float h = p0.y - SN_HZ;
  vec3 col = vec3(0.0);
  if (!hidSky){
    col = snSky(p0, px, true);
    // high clouds, dappled, lit rose and gold from beneath
    if (h > 0.02){
      vec2 cq = vec2(p0.x * 1.9 + t * 0.006, p0.y * 4.6);
      vec2 wq = vec2(fbm3(cq * 0.8 + vec2(0.0, t * 0.004)), fbm3(cq * 0.8 + vec2(5.2, 1.3)));
      float cd = fbm4(cq * 1.5 + wq * 1.7);
      float band = smoothstep(0.03, 0.14, h) * (1.0 - smoothstep(0.48, 0.70, h));
      float dens = smoothstep(0.50, 0.78, cd) * band;
      if (dens > 0.001){
        vec2 toSun = normalize(SN_SUN - p0);
        float cd2 = fbm3(cq * 1.5 + wq * 1.7 + vec2(toSun.x * 0.07, toSun.y * 0.20));
        float lit = clamp((cd - cd2) * 9.0 + 0.45, 0.0, 1.0);
        float near = exp(-rs * 2.6);
        vec3 shade = mix(vec3(0.30, 0.16, 0.30), vec3(0.12, 0.10, 0.24), smoothstep(0.10, 0.50, h));
        vec3 litc = mix(vec3(1.00, 0.46, 0.38), vec3(1.0, 0.80, 0.50), near) * (0.75 + 0.9 * near);
        litc = mix(litc, vec3(0.62, 0.36, 0.52), smoothstep(0.30, 0.62, h) * 0.6);
        vec3 cc = mix(shade, litc, lit);
        cc += vec3(1.0, 0.70, 0.40) * pow(1.0 - smoothstep(0.50, 0.66, cd), 2.0) * near * 0.9;
        col = mix(col, cc, dens * 0.94);
      }
    }
    // long glowing streaks just above the horizon, one across the sun
    float sb = exp(-pow((h - 0.045) * 30.0, 2.0)) + 0.6 * exp(-pow((h - 0.095) * 40.0, 2.0));
    if (sb > 0.01){
      float st = smoothstep(0.55, 0.85, fbm4(vec2(p0.x * 1.4 - t * 0.004, p0.y * 26.0 + 3.0)));
      col = mix(col, mix(vec3(0.85, 0.36, 0.30), vec3(1.0, 0.82, 0.55), exp(-rs * 4.0)) * (0.8 + exp(-rs * 9.0) * 1.5), st * sb * 0.75);
    }
    // soft shafts of light fanning out of the sun
    if (h > 0.0){
      float ang = atan(ds.y, ds.x);
      float rays = n1(ang * 9.0 + t * 0.015) * n1(ang * 23.0 - t * 0.02 + 4.0);
      col += vec3(1.0, 0.68, 0.40) * smoothstep(0.10, 0.55, rays) * exp(-rs * 3.2) * smoothstep(0.0, 0.08, h) * 0.13;
    }

    // birds, a loose flock gliding home
    if (h > 0.08 && h < 0.40){
      for (int i = 0; i < 5; i++){
        float fi = float(i);
        float spd = 0.010 + 0.003 * hash11(fi * 2.1);
        vec2 b = vec2(mod(-1.0 + t * spd + fi * 0.035 + hash11(fi) * 0.05 + 1.0, 2.4) - 1.2, SN_HZ + 0.22 + 0.04 * hash11(fi * 5.3) + 0.012 * sin(t * 0.3 + fi));
        vec2 q = p0 - b;
        if (abs(q.x) > 0.02 || abs(q.y) > 0.02) continue;
        float flap = sin(t * 7.0 + fi * 1.7) * 0.5 + 0.35;
        float ws = 0.0085 - 0.0005 * fi;
        float wing = min(sdSeg(q, vec2(0.0), vec2(-ws, ws * flap * 0.7)), sdSeg(q, vec2(0.0), vec2(ws, ws * flap * 0.7)));
        wing = min(wing, min(sdSeg(q, vec2(-ws, ws * flap * 0.7), vec2(-ws * 1.7, ws * flap * 0.2)), sdSeg(q, vec2(ws, ws * flap * 0.7), vec2(ws * 1.7, ws * flap * 0.2))));
        col = mix(col, vec3(0.10, 0.06, 0.10), af(wing - 0.0011, px) * 0.85);
      }
    }

    // far peaks: snow lit pink on the sunward faces, lavender in the shade, softened by haze
    float x1 = p1.x;
    #define SN_PK(x) (0.15 * smoothstep(0.0, 1.0, 1.0 - abs((x) + 0.80) / 0.34) + 0.085 * smoothstep(0.0, 1.0, 1.0 - abs((x) + 0.30) / 0.24) + 0.18 * smoothstep(0.0, 1.0, 1.0 - abs((x) - 0.62) / 0.34) + 0.10 * smoothstep(0.0, 1.0, 1.0 - abs((x) - 0.95) / 0.22) + 0.03 * fbm1lo((x) * 3.0 + 1.0))
    float pk = SN_PK(x1);
    float jagA = smoothstep(0.015, 0.10, pk);
    float y1 = SN_HZ - 0.022 + pk + 0.055 * (ridge1(x1 * 6.0 + 5.0) - 0.45) * jagA + 0.012 * (ridge1(x1 * 24.0) - 0.4) * jagA;
    if (p1.y < y1 + px){
      float depth = y1 - p1.y;
      // ridges and gullies running down the faces
      vec2 mq = vec2(x1 * 11.0 + depth * 3.0 * sin(x1 * 6.0), depth * 8.0);
      float hA = fbm4(mq) + 0.5 * vnoise(mq * 3.1);
      float hB = fbm4(mq + vec2(0.06, 0.0)) + 0.5 * vnoise((mq + vec2(0.06, 0.0)) * 3.1);
      float slope = (hB - hA) / 0.06;
      float big = (SN_PK(x1 + 0.004) - SN_PK(x1 - 0.004)) / 0.008;
      float sunSide = x1 < SN_SUN.x ? 1.0 : -1.0;
      float lit = smoothstep(-0.25, 0.35, (-slope * 0.35 - big * 1.2) * sunSide);
      float snow = smoothstep(0.60, 0.72, hA * 0.75 + 0.60 - depth * 5.0) * smoothstep(0.02, 0.07, pk);
      vec3 rockL = vec3(0.46, 0.28, 0.38), rockS = vec3(0.17, 0.11, 0.24);
      vec3 snowL = vec3(1.0, 0.68, 0.58), snowS = vec3(0.36, 0.30, 0.52);
      vec3 mc = mix(mix(rockS, rockL, lit * 0.8), mix(snowS, snowL, lit), snow);
      vec3 haze = snSky(vec2(x1, SN_HZ + 0.05), px, false) * 0.72;
      mc = mix(mc, haze, 0.10 + 0.55 * exp(-abs(x1 - SN_SUN.x) * 4.5));
      mc = mix(mc, snFog(x1) * 0.85, smoothstep(0.02, 0.11, depth) * 0.65);
      mc += vec3(1.0, 0.75, 0.5) * exp(-depth * 1200.0) * 0.25 * (0.3 + lit);
      col = mix(col, mc, af(p1.y - y1, px));
    }
  }

  // forested ridges stepping toward us, each fading into the golden haze below its crest
  if (!hidA){
    float yAf = yA + 0.006 * fbm4(vec2(p2.x * 160.0, 1.0)) + 0.004 * n1(p2.x * 420.0);
    if (p2.y < yAf + px * 2.0){
      float depth = max(yAf - p2.y, 0.0);
      vec3 cA = mix(vec3(0.52, 0.31, 0.44), snFog(p2.x) * 0.80, smoothstep(0.0, 0.035, depth) * 0.85);
      cA += vec3(1.0, 0.62, 0.35) * exp(-depth * 650.0) * exp(-abs(p2.x - SN_SUN.x) * 3.0) * 0.5;
      col = mix(col, cA, af(p2.y - yAf, px));
    }
  }
  if (!hidB){
    vec4 rB = snRidge(p3, yB, 0.0032, 0.004, 0.017, 7.0, vec3(0.42, 0.25, 0.37), vec3(0.52, 0.31, 0.43), 0.06, px);
    col = mix(col, rB.rgb, rB.a);
    // a far lake under the sun, a sliver of molten light
    float yL = SN_HZ - 0.092;
    float lake = af(abs(p3.y - yL + 0.004 * n1(p3.x * 30.0)) - 0.0045 * smoothstep(0.30, 0.0, abs(p3.x - 0.20)), px) * step(p3.y, yB - 0.01);
    vec3 lakec = mix(snFog(p3.x) * 1.1, vec3(1.0, 0.86, 0.62) * 2.2, exp(-abs(p3.x - SN_SUN.x) * 18.0));
    col = mix(col, lakec, lake * 0.9);
  }
  if (!hidC){
    vec4 rC = snRidge(p4, yC, 0.0055, 0.008, 0.030, 11.0, vec3(0.25, 0.15, 0.26), vec3(0.34, 0.20, 0.33), 0.08, px);
    col = mix(col, rC.rgb, rC.a);
  }
  // nearer ridges, darker, their feet in the haze
  if (!hidD){
    vec4 rD = snRidge(p5, yD, 0.0085, 0.012, 0.048, 17.0, vec3(0.13, 0.08, 0.15), vec3(0.20, 0.12, 0.21), 0.10, px);
    col = mix(col, rD.rgb, rD.a);
  }
  if (!hidE){
    vec4 rE = snRidge(p5, yE, 0.012, 0.02, 0.07, 23.0, vec3(0.050, 0.036, 0.065), vec3(0.10, 0.065, 0.12), 0.6, px);
    col = mix(col, rE.rgb, rE.a);
  }

  // the near hill on the right, two rows of tall pines catching the light on their edges
  if (p5.x > 0.04 && p5.y < y4 + 0.13){
    float tA = pineRow(p5 + vec2(0.011, 0.0), y4 + 0.035, 0.013, 0.04, 0.09, 33.0);
    float tB = pineRow(p5, y4, 0.017, 0.05, 0.12, 21.0);
    vec2 sunDir = normalize(SN_SUN - p5) * 0.004;
    float back = min(p5.y - y4 - 0.03, tA);
    if (back < px * 2.0){
      float bo = back > -0.006 ? min(p5.y + sunDir.y - y4 - 0.03, pineRow(p5 + sunDir + vec2(0.011, 0.0), y4 + 0.035, 0.013, 0.04, 0.09, 33.0)) : back;
      float rim = clamp((bo - back) / 0.004, 0.0, 1.0) * exp(-abs(back) * 700.0);
      vec3 cb = vec3(0.085, 0.060, 0.095) + vec3(1.0, 0.58, 0.30) * rim * 0.55;
      col = mix(col, cb, af(back, px));
    }
    float m4 = min(p5.y - y4, tB);
    if (m4 < px * 2.0){
      float mo = m4 > -0.006 ? min(p5.y + sunDir.y - y4, pineRow(p5 + sunDir, y4, 0.017, 0.05, 0.12, 21.0)) : m4;
      float rim = clamp((mo - m4) / 0.004, 0.0, 1.0) * exp(-abs(m4) * 700.0);
      vec3 c4 = vec3(0.032, 0.028, 0.044) + vec3(1.0, 0.58, 0.30) * rim * 0.85;
      col = mix(col, c4, af(m4, px));
    }
  }

  // the bluff the rider stands on: rock stepping down to the right, grass along the top
  float m5 = p5.y - y5;
  if (m5 < 0.06){
    float g5 = snGrass(p5, y5 - 0.004, t, 0.030, 1.0) + 0.03 * smoothstep(edgeX - 0.03, edgeX + 0.02, p5.x);
    float gm = min(m5, g5);
    if (gm < px * 2.0){
      float rimB = exp(-abs(gm) * 360.0);
      vec3 c5 = vec3(0.030, 0.025, 0.034) + vec3(1.0, 0.56, 0.28) * rimB * 0.8;
      // horizontal rock strata on the drop, their upper lips catching light
      float strata = fract((p5.y + 0.02 * n1(p5.x * 30.0)) * 38.0);
      float rocky = smoothstep(edgeX - 0.02, edgeX + 0.03, p5.x) * smoothstep(0.003, 0.02, -m5);
      c5 += vec3(0.30, 0.15, 0.10) * smoothstep(0.86, 0.98, strata) * rocky * 0.35 * smoothstep(-0.55, -0.15, p5.y);
      col = mix(col, c5, af(gm, px));
    }
  }

  // horse and rider, rim-lit by the setting sun
  vec2 hp = (p5 - SN_HORSE) / SN_HS;
  if (abs(hp.x) < 1.0 && hp.y > -0.8 && hp.y < 1.0){
    float d = snHorse(hp, t);
    float pxh = px / SN_HS;
    float cov = af(d, pxh);
    if (cov > 0.0){
      float rim = 0.0;
      if (d > -0.024){
        vec2 toSun = normalize(SN_SUN - p5);
        float d2 = snHorse(hp + toSun * 0.016, t);
        rim = clamp((d - d2) / 0.016, 0.0, 1.0) * smoothstep(-0.022, 0.0, d);
      }
      vec3 fc = vec3(0.026, 0.020, 0.028) + vec3(1.0, 0.64, 0.34) * rim * 1.5;
      col = mix(col, fc, cov);
    }
  }
  // grass in front of the hooves
  if (p5.x < -0.22 && p5.y < y5 + 0.06){
    float g6 = snGrass(p5 + vec2(0.37, 0.0), y5 - 0.010, t + 0.4, 0.042, 7.0);
    if (g6 < px * 2.0) col = mix(col, vec3(0.028, 0.024, 0.032) + vec3(1.0, 0.56, 0.28) * exp(-abs(g6) * 300.0) * 0.55, af(g6, px));
  }

  // warm light wrapping everything
  col += vec3(1.0, 0.55, 0.28) * exp(-rs * 5.5) * 0.10;
  col = filmic(col * 1.05);
  col = grade(col, vec3(0.92, 0.95, 1.12), vec3(1.06, 1.0, 0.92), 0.55);
  return col;
}`;
