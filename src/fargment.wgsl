struct Uniforms {
    resolution : vec2<u32>,   // canvas width/height
    aspect_ratio : f32,       // width/height ratio
    zoom : f32,               // zoom level
    center : vec2<f32>,       // center point in complex plane
    num_roots : u32,          // number of active roots
  };
  @group(0) @binding(0) var<uniform> u : Uniforms;

  struct RootData {
    roots : array<vec4<f32>, 16>,  // up to 16 roots (complex numbers as vec4, using .xy)
    colors : array<vec4<f32>, 16>, // corresponding colors in RGB (aligned to vec4)
  };
  @group(0) @binding(1) var<uniform> root_data : RootData;

  struct NewtonResult {
    root_index: i32,
    root_value: vec2<f32>,
    iterations: i32,
    final_distance: f32,
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

  // ----- Newton iteration for dynamic polynomial -------------------------
  // Computes polynomial and its derivative based on current roots
  fn evaluate_polynomial(z: vec2<f32>) -> vec2<f32> {
    // f(z) = (z - r1)(z - r2)...(z - rn)
    var result = vec2(1.0, 0.0);
    for (var i = 0u; i < u.num_roots; i = i + 1u) {
      result = c_mul(result, c_sub(z, root_data.roots[i].xy));
    }
    return result;
  }

  fn evaluate_derivative(z: vec2<f32>) -> vec2<f32> {
    // f'(z) = sum over i of: product over j≠i of (z - rj)
    var result = vec2(0.0, 0.0);
    for (var i = 0u; i < u.num_roots; i = i + 1u) {
      var term = vec2(1.0, 0.0);
      for (var j = 0u; j < u.num_roots; j = j + 1u) {
        if (i != j) {
          term = c_mul(term, c_sub(z, root_data.roots[j].xy));
        }
      }
      result = c_add(result, term);
    }
    return result;
  }

  fn newton_root(z0: vec2<f32>) -> NewtonResult {
    var z = z0;
    const max_iter = 30u;
    const eps = 1e-4f;

    for (var i = 0u; i < max_iter; i = i + 1u) {
      let fz = evaluate_polynomial(z);
      let fprime = evaluate_derivative(z);

      // Avoid division by zero
      if (c_abs(fprime) < 1e-10f) {
        break;
      }

      // Newton iteration: z = z - f(z)/f'(z)
      let step = c_div(fz, fprime);
      z = c_sub(z, step);

      // Check if z is close to any of the roots
      for (var root_idx = 0u; root_idx < u.num_roots; root_idx = root_idx + 1u) {
        let distance = c_abs(c_sub(z, root_data.roots[root_idx].xy));
        if (distance < eps) {
          return NewtonResult(i32(root_idx), root_data.roots[root_idx].xy, i32(i), distance);
        }
      }
    }
    // If no root was found, return -1
    return NewtonResult(-1, vec2(0.0, 0.0), i32(max_iter), 0.0);
  }

  // ----- Color utilities --------------------------------------------------
  fn hsv_to_rgb(hsv: vec3<f32>) -> vec3<f32> {
    let h = hsv.x;
    let s = hsv.y;
    let v = hsv.z;

    let c = v * s;
    let x = c * (1.0 - abs(((h * 6.0) % 2.0) - 1.0));
    let m = v - c;

    var rgb = vec3(0.0);

    if (h < 1.0/6.0) {
      rgb = vec3(c, x, 0.0);
    } else if (h < 2.0/6.0) {
      rgb = vec3(x, c, 0.0);
    } else if (h < 3.0/6.0) {
      rgb = vec3(0.0, c, x);
    } else if (h < 4.0/6.0) {
      rgb = vec3(0.0, x, c);
    } else if (h < 5.0/6.0) {
      rgb = vec3(x, 0.0, c);
    } else {
      rgb = vec3(c, 0.0, x);
    }

    return rgb + vec3(m);
  }

  fn rgb_to_hsv(rgb: vec3<f32>) -> vec3<f32> {
    let max_val = max(max(rgb.r, rgb.g), rgb.b);
    let min_val = min(min(rgb.r, rgb.g), rgb.b);
    let delta = max_val - min_val;

    var h = 0.0;
    let s = select(0.0, delta / max_val, max_val > 0.0);
    let v = max_val;

    if (delta > 0.0) {
      if (max_val == rgb.r) {
        h = ((rgb.g - rgb.b) / delta) / 6.0;
      } else if (max_val == rgb.g) {
        h = (2.0 + (rgb.b - rgb.r) / delta) / 6.0;
      } else {
        h = (4.0 + (rgb.r - rgb.g) / delta) / 6.0;
      }

      if (h < 0.0) {
        h = h + 1.0;
      }
    }

    return vec3(h, s, v);
  }

  fn noise(coord: vec2<f32>) -> f32 {
    return fract(sin(dot(coord, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // ----- Enhanced color palette with smooth gradients ---------------------
  fn smooth_root_color(result: NewtonResult, fragCoord: vec2<f32>) -> vec3<f32> {
    if (result.root_index < 0 || result.root_index >= i32(u.num_roots)) {
      return vec3(1.0); // white for invalid/no convergence
    }

    // Get base color for the root
    let base_color = root_data.colors[result.root_index].rgb;

    // Convert to HSV for easier manipulation
    let hsv = rgb_to_hsv(base_color);

    // Smooth iteration count
    const eps = 1e-4f;
    let smooth_offset = pow(32.0, -result.final_distance / eps);
    let smooth_iter = f32(result.iterations) - smooth_offset - noise(fragCoord);

    // Iteration-based gradient
    let iter_normalized = 0.5 + 0.5 * smooth_iter / 32.0;
    // let brightness_mod = 1.0 - iter_normalized;
    var new_hsv = hsv;
    new_hsv.z = hsv.z * iter_normalized;

    // Ensure visibility
    new_hsv.z = max(new_hsv.z, 0.2);
    new_hsv.y = max(new_hsv.y, 0.3);

    return hsv_to_rgb(new_hsv);
  }

  // ----- Main fragment shader --------------------------------------------
  @fragment
  fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    // Convert pixel coordinates to UV space [0,1]
    let uv = fragCoord.xy / vec2<f32>(u.resolution);

    // Apply proper aspect ratio handling
    var coord: vec2<f32>;
    if (u.aspect_ratio > 1.0) {
      // Wide screen: extend horizontally
      coord = vec2<f32>(
        mix(-2.0 * u.aspect_ratio, 2.0 * u.aspect_ratio, uv.x),
        mix(-2.0, 2.0, uv.y)
      );
    } else {
      // Tall screen: extend vertically
      coord = vec2<f32>(
        mix(-2.0, 2.0, uv.x),
        mix(-2.0 / u.aspect_ratio, 2.0 / u.aspect_ratio, uv.y)
      );
    }

    // Apply zoom and center offset
    coord = (coord - u.center) / u.zoom + u.center;

    let result = newton_root(coord);

    // Use smooth gradient coloring based on convergence
    let color = smooth_root_color(result, fragCoord.xy);

    return vec4<f32>(color, 1.0);
  }
