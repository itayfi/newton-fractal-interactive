@vertex
fn main(@builtin(vertex_index) v: u32) -> @builtin(position) vec4<f32> {
    // Full‑screen triangle (covers the whole clip space)
    var pos = array<vec2<f32>, 3>(
    vec2(-1.0, -1.0),   // bottom‑left
    vec2( 3.0, -1.0),   // bottom‑right (outside clip space)
    vec2(-1.0,  3.0)    // top‑left (outside clip space)
    );
    return vec4<f32>(pos[v], 0.0, 1.0);
}
