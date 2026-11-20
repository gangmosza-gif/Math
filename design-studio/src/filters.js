// Extra photo filters: vignette (custom filter) + colour-matrix helpers (warmth, tint, duotone).
import { filters, classRegistry } from 'fabric';

const vignetteSource = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uAmount;
  varying vec2 vTexCoord;
  void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    float d = distance(vTexCoord, vec2(0.5)) / 0.7071;
    float f = 1.0 - uAmount * smoothstep(0.35, 1.0, d);
    gl_FragColor = vec4(color.rgb * f, color.a);
  }`;

export class Vignette extends filters.BaseFilter {
  getFragmentSource() {
    return vignetteSource;
  }
  applyTo2d({ imageData: { data, width, height } }) {
    const cx = width / 2, cy = height / 2, max = Math.hypot(cx, cy);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const d = Math.hypot(x - cx, y - cy) / max;
        const t = Math.min(1, Math.max(0, (d - 0.35) / 0.65));
        const f = 1 - this.amount * t * t * (3 - 2 * t);
        const i = (y * width + x) * 4;
        data[i] *= f; data[i + 1] *= f; data[i + 2] *= f;
      }
    }
  }
  isNeutralState() {
    return !this.amount;
  }
  sendUniformData(gl, loc) {
    gl.uniform1f(loc.uAmount, this.amount);
  }
}
Vignette.type = 'Vignette';
Vignette.defaults = { amount: 0 };
Vignette.uniformLocations = ['uAmount'];
classRegistry.setClass(Vignette);

export function warmthMatrix(w) {
  // w in -1..1 : warmer = more red / less blue
  return new filters.ColorMatrix({ matrix: [1 + 0.18 * w, 0, 0, 0, 0.04 * w, 0, 1, 0, 0, 0, 0, 0, 1 - 0.18 * w, 0, -0.04 * w, 0, 0, 0, 1, 0] });
}
export function tintMatrix(t) {
  // t in -1..1 : positive = magenta, negative = green
  return new filters.ColorMatrix({ matrix: [1, 0, 0, 0, 0.02 * t, 0, 1 - 0.18 * t, 0, 0, -0.04 * t, 0, 0, 1, 0, 0.02 * t, 0, 0, 0, 1, 0] });
}
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
export function duotoneMatrix(dark, light) {
  const a = hex(dark), b = hex(light);
  const row = (k) => { const d = b[k] - a[k]; return [0.299 * d, 0.587 * d, 0.114 * d, 0, a[k]]; };
  return new filters.ColorMatrix({ matrix: [...row(0), ...row(1), ...row(2), 0, 0, 0, 1, 0] });
}
export function sharpen(amount) {
  const k = amount / 100;
  return new filters.Convolute({ matrix: [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0] });
}
