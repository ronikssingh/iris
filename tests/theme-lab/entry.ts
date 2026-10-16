/* Renders one frame of a world into a canvas, for design review outside the app. */
import { sceneSource, TRANSITION_FRAG, VERT } from '../../src/themes/glsl';
import type { ThemeId } from '../../src/shared/settings';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false })!;
const progs = new Map<string, { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }>();

function compile(id: string) {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'compile failed');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, sceneSource(id as ThemeId)));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link failed');
  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ['uRes', 'uTime', 'uMouse', 'uFlash', 'uFlashPos', 'uVig']) u[n] = gl.getUniformLocation(p, n);
  return { p, u };
}

export function render(id: string, t: number, mx = 0, my = 0, flash = 0, fx = 0.5, fy = 0.7, vig = 0.45): { url?: string; ms?: number; error?: string } {
  try {
    let pr = progs.get(id);
    if (!pr) {
      pr = compile(id);
      progs.set(id, pr);
    }
    const t0 = performance.now();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(pr.p);
    gl.uniform2f(pr.u.uRes, canvas.width, canvas.height);
    gl.uniform1f(pr.u.uTime, t);
    gl.uniform2f(pr.u.uMouse, mx, my);
    gl.uniform1f(pr.u.uFlash, flash);
    gl.uniform2f(pr.u.uFlashPos, fx, fy);
    gl.uniform1f(pr.u.uVig, vig * 0.55);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const ms = performance.now() - t0;
    return { url: canvas.toDataURL('image/png'), ms };
  } catch (e: any) {
    return { error: String(e?.message || e) };
  }
}

/* A frame of a transition between two worlds at progress p (0..1), as the app draws it. */
let trans: { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> } | null = null;
const targets: { fb: WebGLFramebuffer; tex: WebGLTexture }[] = [];
export function transition(a: string, b: string, style: number, p: number, t: number, ox = 0.5, oy = 0.5): { url?: string; ms?: number; error?: string } {
  try {
    const w = canvas.width, h = canvas.height;
    if (!targets.length) {
      for (let i = 0; i < 2; i++) {
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fb = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        targets.push({ fb, tex });
      }
    }
    if (!trans) {
      const mk = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'compile failed');
        return s;
      };
      const pr = gl.createProgram()!;
      gl.attachShader(pr, mk(gl.VERTEX_SHADER, VERT));
      gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, TRANSITION_FRAG));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) || 'link failed');
      const u: Record<string, WebGLUniformLocation | null> = {};
      for (const n of ['uA', 'uB', 'uP', 'uStyle', 'uRes', 'uTime', 'uOrigin']) u[n] = gl.getUniformLocation(pr, n);
      trans = { p: pr, u };
    }
    const t0 = performance.now();
    for (const [i, id] of [a, b].entries()) {
      let pr = progs.get(id);
      if (!pr) {
        pr = compile(id);
        progs.set(id, pr);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[i].fb);
      gl.viewport(0, 0, w, h);
      gl.useProgram(pr.p);
      gl.uniform2f(pr.u.uRes, w, h);
      gl.uniform1f(pr.u.uTime, t);
      gl.uniform2f(pr.u.uMouse, 0, 0);
      gl.uniform1f(pr.u.uFlash, 0);
      gl.uniform2f(pr.u.uFlashPos, 0.5, 0.7);
      gl.uniform1f(pr.u.uVig, 0.25);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(trans.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[0].tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, targets[1].tex);
    gl.uniform1i(trans.u.uA, 0);
    gl.uniform1i(trans.u.uB, 1);
    const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    gl.uniform1f(trans.u.uP, eased);
    gl.uniform1i(trans.u.uStyle, style);
    gl.uniform2f(trans.u.uRes, w, h);
    gl.uniform1f(trans.u.uTime, t);
    gl.uniform2f(trans.u.uOrigin, ox, oy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { url: canvas.toDataURL('image/png'), ms: performance.now() - t0 };
  } catch (e: any) {
    return { error: String(e?.message || e) };
  }
}
