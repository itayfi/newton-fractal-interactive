// ====================== Complex Number Utilities ======================

export interface Complex {
  real: number;
  imag: number;
}

export class ComplexNumber implements Complex {
  public real: number;
  public imag: number;

  constructor(real: number, imag: number) {
    this.real = real;
    this.imag = imag;
  }

  static fromPolar(magnitude: number, angle: number): ComplexNumber {
    return new ComplexNumber(
      magnitude * Math.cos(angle),
      magnitude * Math.sin(angle)
    );
  }

  add(other: Complex): ComplexNumber {
    return new ComplexNumber(this.real + other.real, this.imag + other.imag);
  }

  subtract(other: Complex): ComplexNumber {
    return new ComplexNumber(this.real - other.real, this.imag - other.imag);
  }

  multiply(other: Complex): ComplexNumber {
    return new ComplexNumber(
      this.real * other.real - this.imag * other.imag,
      this.real * other.imag + this.imag * other.real
    );
  }

  divide(other: Complex): ComplexNumber {
    const denominator = other.real * other.real + other.imag * other.imag;
    return new ComplexNumber(
      (this.real * other.real + this.imag * other.imag) / denominator,
      (this.imag * other.real - this.real * other.imag) / denominator
    );
  }

  magnitude(): number {
    return Math.sqrt(this.real * this.real + this.imag * this.imag);
  }

  angle(): number {
    return Math.atan2(this.imag, this.real);
  }

  toString(): string {
    const sign = this.imag >= 0 ? '+' : '-';
    return `${this.real.toFixed(3)} ${sign} ${Math.abs(this.imag).toFixed(3)}i`;
  }

  toArray(): [number, number] {
    return [this.real, this.imag];
  }
}

// ====================== OKHSL Color Space Utilities ======================

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface OKHSL {
  h: number; // hue [0, 360)
  s: number; // saturation [0, 1]
  l: number; // lightness [0, 1]
}

// OKHSL to RGB conversion (simplified implementation)
export function okhslToRgb(okhsl: OKHSL): RGB {
  const { h, s, l } = okhsl;
  
  // Convert hue to [0, 1] range
  const hNorm = (h % 360) / 360;
  
  // Simplified OKHSL to RGB conversion
  // This is a basic implementation - for production use, consider a more accurate conversion
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hNorm * 6) % 2) - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (hNorm < 1/6) {
    r = c; g = x; b = 0;
  } else if (hNorm < 2/6) {
    r = x; g = c; b = 0;
  } else if (hNorm < 3/6) {
    r = 0; g = c; b = x;
  } else if (hNorm < 4/6) {
    r = 0; g = x; b = c;
  } else if (hNorm < 5/6) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  return {
    r: Math.max(0, Math.min(1, r + m)),
    g: Math.max(0, Math.min(1, g + m)),
    b: Math.max(0, Math.min(1, b + m))
  };
}

// Generate evenly distributed hues for n colors
export function generateRootColors(numRoots: number): RGB[] {
  const colors: RGB[] = [];
  const saturation = 0.8;
  const lightness = 0.6;
  
  for (let i = 0; i < numRoots; i++) {
    const hue = (i * 360) / numRoots;
    const okhsl: OKHSL = { h: hue, s: saturation, l: lightness };
    colors.push(okhslToRgb(okhsl));
  }
  
  return colors;
}

// ====================== Coordinate Transformation Utilities ======================

export interface ViewportConfig {
  zoom: number;
  center: Complex;
  aspectRatio: number;
}

export function screenToComplex(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  viewport: ViewportConfig
): ComplexNumber {
  // Convert screen coordinates to normalized [0,1] coordinates
  const uv = {
    x: screenX / canvasWidth,
    y: screenY / canvasHeight
  };

  // Simple mapping to [-2, 2] range for now (ignoring aspect ratio for debugging)
  const coord = {
    real: -2.0 + uv.x * 4.0,
    imag: -2.0 + uv.y * 4.0
  };

  // Apply zoom and center offset (inverse of shader transformation)
  const result = new ComplexNumber(
    (coord.real - viewport.center.real) / viewport.zoom + viewport.center.real,
    (coord.imag - viewport.center.imag) / viewport.zoom + viewport.center.imag
  );

  return result;
}

export function complexToScreen(
  complex: Complex,
  canvasWidth: number,
  canvasHeight: number,
  viewport: ViewportConfig
): { x: number; y: number } {
  // Apply zoom and center offset
  const coord = {
    real: (complex.real - viewport.center.real) * viewport.zoom + viewport.center.real,
    imag: (complex.imag - viewport.center.imag) * viewport.zoom + viewport.center.imag
  };

  // Simple mapping from [-2, 2] to [0, 1] (ignoring aspect ratio for debugging)
  const uv = {
    x: (coord.real + 2.0) / 4.0,
    y: (coord.imag + 2.0) / 4.0
  };

  // Convert to screen coordinates
  return {
    x: uv.x * canvasWidth,
    y: uv.y * canvasHeight
  };
}

// ====================== Root Management Interfaces ======================

export interface RootElement {
  id: string;
  complex: ComplexNumber;
  color: RGB;
  element: HTMLElement;
  isDragging: boolean;
}

export interface RootManagerConfig {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  onRootChange: (roots: ComplexNumber[]) => void;
  minRoots: number;
  maxRoots: number;
}

// ====================== Default Root Values ======================

export const DEFAULT_ROOTS: ComplexNumber[] = [
  new ComplexNumber(1.0, 0.0),                    // 1
  new ComplexNumber(-0.5, 0.8660254037844387),    // -1/2 + i*sqrt(3)/2
  new ComplexNumber(-0.5, -0.8660254037844387)    // -1/2 - i*sqrt(3)/2
];
