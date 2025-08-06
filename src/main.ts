/* ====================== 0️⃣  Shader imports ====================== */
import vertexWGSL from './vertex.wgsl?raw';
import fragmentWGSL from './fargment.wgsl?raw';

/* ====================== 1️⃣  Utility helpers ====================== */
async function requestWebGPU() {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported on this browser.');
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('Failed to get GPU adapter.');
    return adapter.requestDevice();
  }

  /* ====================== 2️⃣  WebGPU initialisation ====================== */
  async function init() {
    const device = await requestWebGPU();
  
    const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;

    if (!canvas) throw new Error('Failed to get canvas element.');
    const context = canvas.getContext('webgpu');
    if (!context) throw new Error('Failed to get WebGPU context.');
    const format = navigator.gpu.getPreferredCanvasFormat();
  
    // Resize canvas to device pixel ratio
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = canvas.clientWidth  * dpr;
      canvas.height = canvas.clientHeight * dpr;
      context.configure({
        device,
        format,
        alphaMode: 'opaque',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  
    // Uniform buffer: resolution (u32, u32)
    const uniformBufferSize = 16; // 2 * u32 + padding
    const uniformBuffer = device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  
    // Bind group layout & bind group
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      }]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
    });
  
    // Pipeline
    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: {
        module: device.createShaderModule({ code: vertexWGSL }),
        entryPoint: 'main',
      },
      fragment: {
        module: device.createShaderModule({ code: fragmentWGSL }),
        entryPoint: 'main',
        targets: [{ format }]
      },
      primitive: { topology: 'triangle-list' },
    });
  
    // Main render loop
    const render = () => {
      // Update uniform buffer with current canvas size
      device.queue.writeBuffer(uniformBuffer, 0,
        new Uint32Array([canvas.width, canvas.height]));
      // Acquire a command encoder and a render pass
      const commandEncoder = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 }
        }]
      });
      renderPass.setPipeline(pipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(3, 1, 0, 0);   // one triangle
      renderPass.end();
  
      device.queue.submit([commandEncoder.finish()]);
  
      requestAnimationFrame(render);
    };
  
    requestAnimationFrame(render);
  }
  
  init().catch(err => console.error(err));
  