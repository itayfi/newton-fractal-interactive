struct Uniforms {
    resolution : vec2<u32>,   // canvas width/height
  };
  @group(0) @binding(0) var<uniform> u : Uniforms;

  struct NewtonResult {
    root_index: i32,
    root_value: vec2<f32>,
  };

  // ----- Complex helpers -------------------------------------------------
  fn c_add(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return a + b;
  }
  fn c_sub(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return a - b;
  }
  fn c_mul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    // (a+ib)(c+id) = (ac - bd) + i(ad + bc)
    return vec2<f32>(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
  }
  fn c_abs(a: vec2<f32>) -> f32 {
    return sqrt(a.x*a.x + a.y*a.y);
  }
  fn c_div(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    // a / b = (a * conj(b)) / |b|^2
    let denom = b.x*b.x + b.y*b.y;
    return vec2<f32>((a.x*b.x + a.y*b.y)/denom,
                     (a.y*b.x - a.x*b.y)/denom);
  }

  // ----- Newton iteration for f(z) = z^3 - 1 -----------------------------
  // roots: 1, -0.5 ± i*sqrt(3)/2
  fn newton_root(z0: vec2<f32>) -> NewtonResult {
    var z = z0;
    const max_iter = 30u;
    const eps = 1e-4f;
    for (var i = 0u; i < max_iter; i = i + 1u) {
      // f(z) = z^3 - 1
      let z2 = c_mul(z, z);
      let fz = c_sub(c_mul(z, z2), vec2(1.0, 0.0));
      // f'(z) = 3*z^2
      let fprime = c_mul(vec2(3.0, 0.0), z2);
      // z = z - f(z)/f'(z)
      z = c_sub(z, c_div(fz, fprime));

      // check if z is close to one of the roots
      let r1 = vec2(1.0, 0.0);
      let r2 = vec2(-0.5, 0.8660254);  // -1/2 + i*sqrt(3)/2
      let r3 = vec2(-0.5, -0.8660254); // -1/2 - i*sqrt(3)/2

      if (c_abs(c_sub(z, r1)) < eps) { return NewtonResult(0, r1); }
      if (c_abs(c_sub(z, r2)) < eps) { return NewtonResult(1, r2); }
      if (c_abs(c_sub(z, r3)) < eps) { return NewtonResult(2, r3); }
    }
    // If no root was found, return -1
    return NewtonResult(-1, vec2(0.0, 0.0));
  }

  // ----- Color palette ----------------------------------------------------
  fn root_color(idx: i32) -> vec3<f32> {
    // 0 → red, 1 → green, 2 → blue
    switch (idx) {
      case 0: {
        return vec3(1.0, 0.0, 0.0);  // red
      }
      case 1: {
        return vec3(0.0, 1.0, 0.0);  // green
      }
      case 2: {
        return vec3(0.0, 0.0, 1.0);  // blue
      }
      default: {
        return vec3(0.0, 0.0, 0.0); // black (shouldn't happen)
      }
    }
  }

  // ----- Main fragment shader --------------------------------------------
  @fragment
  fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    // Normalise pixel coordinate to range [-2, 2] × [-2, 2] (complex plane)
    let uv = fragCoord.xy / vec2<f32>(u.resolution);
    let x = mix(-2.0, 2.0, uv.x);
    let y = mix(-2.0, 2.0, uv.y);
    let z0 = vec2<f32>(x, y);

    let result = newton_root(z0);
    let rootIdx = result.root_index;

    // Add a little dithering based on iteration count (here just use rootIdx)
    let color = root_color(rootIdx) * 0.8 + vec3(0.2); // slightly faded

    return vec4<f32>(color, 1.0);
  }
