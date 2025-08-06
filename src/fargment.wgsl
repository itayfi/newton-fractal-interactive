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
      z = c_sub(z, c_div(fz, fprime));

      // Check if z is close to any of the roots
      for (var root_idx = 0u; root_idx < u.num_roots; root_idx = root_idx + 1u) {
        if (c_abs(c_sub(z, root_data.roots[root_idx].xy)) < eps) {
          return NewtonResult(i32(root_idx), root_data.roots[root_idx].xy);
        }
      }
    }
    // If no root was found, return -1
    return NewtonResult(-1, vec2(0.0, 0.0));
  }

  // ----- Color palette ----------------------------------------------------
  fn root_color(idx: i32) -> vec3<f32> {
    if (idx < 0 || idx >= i32(u.num_roots)) {
      return vec3(0.0, 0.0, 0.0); // black for invalid/no convergence
    }
    return root_data.colors[idx].rgb;
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
    let rootIdx = result.root_index;

    // Use the precomputed colors from the uniform buffer
    let color = root_color(rootIdx) * 0.9 + vec3(0.1); // slightly faded

    return vec4<f32>(color, 1.0);
  }
