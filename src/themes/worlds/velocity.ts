/* Velocity: running flat out through a tunnel of gold and crimson lightning toward a white-hot horizon. */

export const velocity = /* glsl */ `
/* zig-zag noise: straight segments between random points, for lightning */
float vlZig(float x){ float i = floor(x); float f = fract(x); return mix(hash11(i), hash11(i + 1.0), f); }
float vlBolt(float x){ return vlZig(x) * 0.55 + vlZig(x * 2.7 + 13.0) * 0.30 + vlZig(x * 7.3 + 29.0) * 0.15; }

vec3 scene(vec2 uv){
  float asp = uRes.x / uRes.y;
  float px = 1.6 / uRes.y;
  vec2 m = uMouse;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;
  // the vanishing point wanders a little, as if the path curves
  vec2 c = vec2(0.10 * sin(t * 0.17) + m.x * 0.05, 0.05 * sin(t * 0.23 + 1.0) + m.y * 0.03);
  vec2 q = p - c;
  float r = length(q);
  float a = atan(q.y, q.x);
  float spin = t * 0.10;
  float z = 0.32 / max(r, 0.004);                    // depth down the tunnel
  float speed = 2.4;
  float v = z + t * speed;                           // distance travelled along the wall
  float u = (a + spin) / 6.28318 + z * 0.035;        // the tunnel twists as it goes

  // the tunnel wall: crimson energy streaming past, swirling, streaked by speed
  float flow = fbm4(vec2(u * 8.0, v * 0.45)) * 0.6 + fbm3(vec2(u * 22.0 + v * 0.1, v * 1.1)) * 0.4;
  float streak = pow(fbm3(vec2(u * 54.0, v * 0.22 - t * 0.3)), 3.0);
  float ribs = pow(0.5 + 0.5 * sin(v * 5.0 + u * 6.28318 * 3.0), 6.0);
  vec3 wall = mix(vec3(0.10, 0.005, 0.012), vec3(0.62, 0.035, 0.035), smoothstep(0.38, 0.72, flow));
  wall += vec3(1.0, 0.45, 0.08) * smoothstep(0.64, 0.86, flow) * 0.9;
  wall += vec3(1.0, 0.70, 0.25) * streak * 2.0;
  wall += vec3(0.9, 0.18, 0.06) * ribs * 0.35;
  // deeper means hotter and brighter
  float depthGlow = smoothstep(2.0, 18.0, z);
  vec3 col = wall * (0.35 + 0.65 * smoothstep(0.6, 4.0, z));
  col = mix(col, vec3(1.0, 0.72, 0.35) * 1.4, depthGlow * 0.75);

  // rings of energy rushing past
  float ring = pow(0.5 + 0.5 * sin(v * 2.2), 18.0);
  col += vec3(1.0, 0.45, 0.10) * ring * smoothstep(0.8, 3.0, z) * (1.0 - depthGlow) * 0.7;

  // lightning running along the walls: jagged bolts that flicker in and out
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    float seed = floor(t * (0.7 + 0.13 * fi) + fi * 3.7);
    float life = fract(t * (0.7 + 0.13 * fi) + fi * 3.7);
    float on = smoothstep(0.0, 0.05, life) * (1.0 - smoothstep(0.35, 0.6, life));
    float base = hash11(seed * 1.3 + fi) * 6.28318;
    // the bolt's angle wanders as it runs down the tunnel
    float wob = (vlBolt(r * 9.0 + seed * 7.0) - 0.5) * 1.2 + (vlZig(r * 60.0 + seed * 3.0) - 0.5) * 0.12 + z * 0.035 * 6.28318;
    float da = mod(a + spin - base - wob + 3.14159, 6.28318) - 3.14159;
    float dist = abs(da) * r;                         // in screen units
    float w = 0.0018 + 0.004 * r;
    float core = exp(-dist / (w * 0.35));
    float glow = exp(-dist / (w * 4.0));
    float span = smoothstep(0.35, 0.9, z) * (1.0 - smoothstep(3.5, 7.0, z));
    vec3 boltC = mix(vec3(1.0, 0.85, 0.40), vec3(1.0, 0.25, 0.08), step(4.0, fi));
    col += (vec3(1.0, 0.97, 0.88) * core * 1.6 + boltC * glow * 0.55) * on * span;
    // branches forking off the main bolt
    float wob2 = wob + (vlBolt(r * 18.0 + seed * 11.0) - 0.5) * 0.9;
    float db = abs(mod(a + spin - base - wob2 + 3.14159, 6.28318) - 3.14159) * r;
    float br = step(0.55, n1(r * 9.0 + seed * 5.0));
    col += boltC * exp(-db / (w * 0.6)) * 0.6 * on * span * br;
  }

  // sparks and debris flung outward past us
  for (int i = 0; i < 24; i++){
    float fi = float(i);
    float ang = hash11(fi * 7.1) * 6.28318 + spin * 0.4;
    float sp = 0.6 + hash11(fi * 3.3) * 0.9;
    float ph = fract(t * sp * 0.5 + hash11(fi));
    float rr = 0.02 + ph * ph * 1.1;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 head = c + dir * rr;
    vec2 tail = c + dir * max(rr - 0.03 - ph * 0.12, 0.0);
    float d = sdSeg(p, tail, head);
    col += mix(vec3(1.0, 0.75, 0.30), vec3(1.0, 0.30, 0.10), hash11(fi * 2.0)) * exp(-d / (px * (0.6 + ph))) * ph * 0.9;
  }

  // the white-hot point everything races toward
  col += vec3(1.0, 0.90, 0.70) * (exp(-r * 18.0) * 1.6 + exp(-r * 5.0) * 0.35);
  // a pulse when lightning cracks close by
  col += vec3(1.0, 0.80, 0.45) * uFlash * 0.25 * (0.5 + 0.5 * exp(-r * 2.0));

  // vignette of motion: the edges smear darker
  col *= 0.75 + 0.25 * smoothstep(1.1, 0.2, r);
  col = filmic(col * 1.1);
  col = grade(col, vec3(1.05, 0.92, 0.95), vec3(1.02, 1.0, 0.94), 0.4);
  return col;
}`;
