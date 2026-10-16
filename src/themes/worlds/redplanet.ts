/* Red Planet: rust dunes under a butterscotch sky, a small sun setting in a cold blue halo, two moons rising. */

export const redplanet = /* glsl */ `
const float RP_HZ = -0.06;
const vec2 RP_SUN = vec2(-0.24, -0.035);

vec3 rpSky(vec2 p, float px, float t){
  float h = p.y - RP_HZ;
  vec3 c = mix(vec3(0.62, 0.40, 0.26), vec3(0.30, 0.16, 0.12), smoothstep(0.0, 0.30, h));
  c = mix(c, vec3(0.06, 0.04, 0.06), smoothstep(0.25, 0.70, h));
  // dust scatters the light forward: a cold blue halo hugs the setting sun
  float r = length((p - RP_SUN) * vec2(0.85, 1.0));
  c = mix(c, vec3(0.42, 0.62, 0.82), exp(-r * 4.2) * 0.85);
  c += vec3(0.65, 0.82, 1.0) * exp(-r * 14.0) * 0.6;
  c = mix(c, vec3(0.92, 0.96, 1.0) * 2.5, af(r - 0.016, px));
  // two small moons: one a lumpy crescent, one a bright point
  vec2 m1 = p - vec2(0.36 + 0.004 * sin(t * 0.02), 0.25);
  float moon1 = sdEllipse(m1, vec2(0.016, 0.012)) + 0.002 * n1(atan(m1.y, m1.x) * 4.0);
  float lit1 = smoothstep(-0.006, 0.010, dot(m1, normalize(RP_SUN - vec2(0.36, 0.25))));
  c = mix(c, vec3(0.75, 0.68, 0.60) * (0.15 + 0.85 * lit1), af(moon1, px));
  vec2 m2 = p - vec2(0.12 + 0.02 * sin(t * 0.013), 0.37);
  c += vec3(0.95, 0.9, 0.85) * exp(-dot(m2, m2) / (px * px * 2.0)) * 1.2;
  c += starfield(p, 80.0, 0.96, t, px) * smoothstep(0.30, 0.6, h) * 0.8;
  // high, thin dust veils
  float veil = smoothstep(0.5, 0.85, fbm4(vec2(p.x * 1.2 + t * 0.004, p.y * 7.0)));
  c = mix(c, c * 1.15 + vec3(0.08, 0.04, 0.02), veil * smoothstep(0.05, 0.25, h) * 0.5);
  return c;
}

/* a dune layer: sharp crests; the faces turned to the low sun on the left glow, the slip faces fall into shadow */
vec4 rpDunes(vec2 p, float base, float amp, float freq, float seed, vec3 lit, vec3 shade, vec3 haze, float hazeAmt, float px, float t){
  float x = p.x * freq + seed;
  float n = n1(x * 0.7) * 0.65 + n1(x * 1.9 + 7.0) * 0.35;
  float u = x * 0.5 + n * 0.8;
  float f = fract(u) - 0.5;                       // 0 on a crest, negative to its left
  float crest = 1.0 - abs(f) * 2.0;
  float top = base + amp * (0.30 * n + 0.70 * pow(crest, 1.5));
  float m = p.y - top;
  if (m > px * 2.0) return vec4(0.0);
  float depth = top - p.y;
  float sx = f / (0.5 * freq);                     // screen distance from the crest
  // the shadow line runs down and away from each crest; the next lit face begins on a line from the trough
  float g = fract(u - depth * (0.9 + 0.4 * n) * 0.5 * freq) - 0.5;
  float soft = 0.012 * freq;
  float shadow = smoothstep(-soft * 0.3, soft, g) * (1.0 - smoothstep(0.5 - soft * 2.0, 0.5, g));
  vec3 c = mix(lit * (0.75 + 0.35 * exp(-depth / (amp + 0.001))), shade, shadow);
  // wind ripples, combed along the faces
  float rip = sin((sx * 0.6 + depth * 1.4) * 900.0 / (freq * 0.6 + 0.6) + n * 12.0);
  c *= 0.93 + 0.07 * rip * (1.0 - shadow * 0.6);
  // the crest line catches the sun
  c += lit * 0.55 * exp(-depth / (px * 2.0)) * (0.5 + 0.5 * exp(-abs(p.x - RP_SUN.x) * 2.0));
  c = mix(c, haze, hazeAmt);
  return vec4(c, af(m, px));
}

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  vec2 p0 = p + m * vec2(0.004, 0.003);
  vec2 p1 = p + m * vec2(0.010, 0.005);
  vec2 p2 = p + m * vec2(0.018, 0.007);
  vec2 p3 = p + m * vec2(0.028, 0.010);
  vec2 p4 = p + m * vec2(0.042, 0.014);

  vec3 col = rpSky(p0, px, t);
  vec3 haze = mix(vec3(0.55, 0.38, 0.28), vec3(0.50, 0.62, 0.75), exp(-abs(p1.x - RP_SUN.x) * 3.0) * 0.6);

  // distant mesas, their strata faint with dust
  float mx = p1.x;
  float mesa = RP_HZ + 0.012 * fbm1lo(mx * 6.0);
  mesa += 0.075 * smoothstep(0.02, 0.0, abs(mx - 0.50) - 0.12) + 0.05 * smoothstep(0.015, 0.0, abs(mx - 0.25) - 0.04) + 0.06 * smoothstep(0.03, 0.0, abs(mx + 0.62) - 0.10);
  if (p1.y < mesa + px){
    float strata = 0.93 + 0.07 * sin(p1.y * 260.0 + n1(mx * 20.0) * 2.0);
    float side = smoothstep(-0.01, 0.01, n1(mx * 30.0) - 0.5);
    vec3 mc = mix(mix(vec3(0.42, 0.24, 0.17), vec3(0.22, 0.12, 0.11), side), haze, 0.55) * strata;
    col = mix(col, mc, af(p1.y - mesa, px));
  }
  // a dust devil spinning far off
  {
    vec2 dq = p1 - vec2(0.30 + 0.05 * sin(t * 0.05), RP_HZ);
    float hgt = clamp(dq.y / 0.20, 0.0, 1.0);
    float w = 0.006 + 0.03 * hgt * hgt;
    float swirl = sin(dq.y * 120.0 - t * 4.0 + dq.x / w * 2.0) * 0.5 + 0.5;
    float dd = smoothstep(w, w * 0.3, abs(dq.x - 0.01 * sin(dq.y * 20.0 + t))) * step(0.0, dq.y) * (1.0 - hgt);
    col = mix(col, vec3(0.62, 0.45, 0.34), dd * (0.35 + 0.25 * swirl) * 0.6);
  }

  // dunes stepping toward us, deeper red with each row
  vec4 d1 = rpDunes(p1, RP_HZ - 0.025, 0.035, 4.0, 1.0, vec3(0.80, 0.42, 0.24), vec3(0.32, 0.14, 0.12), haze, 0.45, px, t);
  col = mix(col, d1.rgb, d1.a);
  vec4 d2 = rpDunes(p2, RP_HZ - 0.075, 0.055, 2.6, 4.0, vec3(0.85, 0.40, 0.20), vec3(0.24, 0.09, 0.09), haze, 0.22, px, t);
  col = mix(col, d2.rgb, d2.a);
  // the rover parked on a crest, its tracks winding back over the sand
  {
    float zx = 0.42;
    float x = zx * 2.6 + 4.0;
    float n = n1(x) * 0.65 + n1(x * 2.3 + 7.0) * 0.35;
    float topY = RP_HZ - 0.075 + 0.055 * (0.35 * n + 0.65 * pow(1.0 - abs(fract(x * 0.5 + n * 0.6) - 0.5) * 2.0, 1.6));
    vec2 rq = (p2 - vec2(zx, topY)) / 0.030;
    float body = sdBox(rq - vec2(0.0, 0.55), vec2(0.62, 0.18)) - 0.04;
    float mast = sdBox(rq - vec2(0.38, 1.05), vec2(0.04, 0.35));
    float head = sdBox(rq - vec2(0.42, 1.45), vec2(0.16, 0.08));
    float dish = sdEllipse(rq - vec2(-0.25, 0.92), vec2(0.20, 0.06));
    float wheels = 1e5;
    for (int k = 0; k < 3; k++) wheels = min(wheels, sdCircle(rq - vec2(-0.48 + float(k) * 0.48, 0.18), 0.16));
    float rover = min(min(body, mast), min(min(head, dish), wheels));
    rover = min(rover, sdSeg(rq, vec2(-0.48, 0.18), vec2(0.48, 0.18)) - 0.05);
    vec3 rc = vec3(0.10, 0.07, 0.06) + vec3(0.9, 0.7, 0.5) * exp(-abs(rover) * 0.030 / (px * 1.5)) * 0.35;
    col = mix(col, rc, af(rover * 0.030, px));
    float blink = step(0.85, fract(t * 0.5));
    col += vec3(0.4, 1.0, 0.6) * exp(-length(rq - vec2(0.55, 1.45)) * 9.0) * blink * 0.8;
  }
  vec4 d3 = rpDunes(p3, RP_HZ - 0.16, 0.085, 1.6, 9.0, vec3(0.95, 0.40, 0.18), vec3(0.15, 0.055, 0.065), haze, 0.06, px, t);
  col = mix(col, d3.rgb, d3.a);
  // tracks in the near dune
  if (d3.a > 0.5){
    float tk = abs(p3.y - (RP_HZ - 0.20) - 0.03 * sin(p3.x * 6.0 + 1.0) - p3.x * 0.04);
    float tr = smoothstep(0.004, 0.0, abs(tk - 0.010)) + smoothstep(0.004, 0.0, abs(tk + 0.010));
    col *= 1.0 - tr * 0.25 * smoothstep(0.45, 0.2, p3.x) * smoothstep(-0.5, 0.0, p3.x);
  }
  vec4 d4 = rpDunes(p4, RP_HZ - 0.30, 0.13, 0.9, 15.0, vec3(0.92, 0.36, 0.16), vec3(0.10, 0.04, 0.05), haze, 0.0, px, t);
  col = mix(col, d4.rgb, d4.a);

  // sand streaming off the near crests in the wind
  float stream = smoothstep(0.55, 0.9, fbm4(vec2(p4.x * 6.0 - t * 0.6, p4.y * 30.0)));
  col += vec3(0.75, 0.45, 0.30) * stream * exp(-abs(p4.y + 0.30) * 18.0) * 0.18;
  // fine dust hanging in the air
  col = mix(col, haze * 0.9, 0.06);

  col = filmic(col * 1.15);
  col = grade(col, vec3(0.92, 0.96, 1.10), vec3(1.06, 1.0, 0.92), 0.45);
  return col;
}`;
