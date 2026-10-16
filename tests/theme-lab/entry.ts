/* Renders one frame of a world into a canvas, for design review outside the app. */
import { sceneSource, VERT } from '../../src/themes/glsl';
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
