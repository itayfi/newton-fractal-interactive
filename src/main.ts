/* ====================== 0️⃣  Imports ====================== */
import vertexWGSL from './vertex.wgsl?raw';
import fragmentWGSL from './fargment.wgsl?raw';
import { RootManager } from './RootManager.js';
import { ComplexNumber, type ViewportConfig } from './utils.js';

console.log('Main.ts loaded');

/* ====================== 1️⃣  Utility helpers ====================== */
async function requestWebGPU() {
    console.log('Checking WebGPU support...');
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported on this browser. Please use Chrome/Edge 113+ or Firefox with WebGPU enabled.');
    }
    console.log('WebGPU API available, requesting adapter...');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('Failed to get GPU adapter. Your GPU may not support WebGPU.');
    console.log('GPU adapter obtained, requesting device...');
    const device = await adapter.requestDevice();
    console.log('WebGPU device ready');
    return device;
  }

/* ====================== 2️⃣  Newton Fractal Application ====================== */
class NewtonFractalApp {
  private device!: GPUDevice;
  private canvas!: HTMLCanvasElement;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private rootBuffer!: GPUBuffer;
  private bindGroup!: GPUBindGroup;
  private rootManager!: RootManager;
  private msaaTexture!: GPUTexture;
  private readonly sampleCount = 4; // 4x MSAA

  private viewport: ViewportConfig = {
    zoom: 1.0,
    center: new ComplexNumber(0, 0),
    aspectRatio: 1.0
  };

  private animationId: number = 0;

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Newton Fractal App...');

      // Initialize WebGPU
      this.device = await requestWebGPU();
      console.log('WebGPU device acquired');

      this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
      if (!this.canvas) throw new Error('Failed to get canvas element.');

      this.context = this.canvas.getContext('webgpu')!;
      if (!this.context) throw new Error('Failed to get WebGPU context.');

      this.format = navigator.gpu.getPreferredCanvasFormat();
      console.log('Canvas format:', this.format);

      // Setup canvas and context
      this.setupCanvas();
      console.log('Canvas setup complete');

      // Create buffers and pipeline
      await this.createBuffers();
      console.log('Buffers created');

      await this.createPipeline();
      console.log('Pipeline created');

      // Initialize root manager
      this.initializeRootManager();
      console.log('Root manager initialized');

      // Setup UI event handlers
      this.setupUIHandlers();
      console.log('UI handlers setup');

      // Start render loop
      this.startRenderLoop();
      console.log('Render loop started');

    } catch (error) {
      console.error('Failed to initialize:', error);
      throw error;
    }
  }

  private setupCanvas(): void {
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = this.canvas.clientWidth * dpr;
      this.canvas.height = this.canvas.clientHeight * dpr;

      this.viewport.aspectRatio = this.canvas.clientWidth / this.canvas.clientHeight;

      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'opaque',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });

      // Create MSAA texture for antialiasing
      this.createMSAATexture();

      // Update root manager viewport
      if (this.rootManager) {
        this.rootManager.setViewport(this.viewport);
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }

  private createMSAATexture(): void {
    // Destroy existing MSAA texture if it exists
    if (this.msaaTexture) {
      this.msaaTexture.destroy();
    }

    // Create new MSAA texture
    this.msaaTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      sampleCount: this.sampleCount,
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  private async createBuffers(): Promise<void> {
    // Uniform buffer: resolution (8 bytes) + aspect_ratio (4) + zoom (4) + center (8) + num_roots (4) + padding
    // WGSL alignment: struct members must be aligned to 16 bytes
    const uniformBufferSize = 32; // Aligned to 16 bytes
    this.uniformBuffer = this.device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Root data buffer: 16 roots (vec4<f32>) + 16 colors (vec4<f32>)
    // Each vec4<f32> = 16 bytes
    const rootBufferSize = 16 * 16 + 16 * 16; // 16*16 + 16*16 = 512 bytes
    this.rootBuffer = this.device.createBuffer({
      size: rootBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    console.log('Root buffer size:', rootBufferSize);
  }

  private async createPipeline(): Promise<void> {
    // Bind group layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        }
      ]
    });

    // Create bind group
    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.rootBuffer } }
      ]
    });

    // Create render pipeline with MSAA support
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: {
        module: this.device.createShaderModule({ code: vertexWGSL }),
        entryPoint: 'main',
      },
      fragment: {
        module: this.device.createShaderModule({ code: fragmentWGSL }),
        entryPoint: 'main',
        targets: [{ format: this.format }]
      },
      primitive: { topology: 'triangle-list' },
      multisample: {
        count: this.sampleCount,
      },
    });
  }

  private initializeRootManager(): void {
    const container = document.getElementById('interactive-layer') as HTMLElement;
    if (!container) throw new Error('Interactive layer not found');

    console.log('Creating root manager with container:', container);

    // Create a temporary callback that will be safe during initialization
    const onRootChangeCallback = (roots: ComplexNumber[]) => {
      console.log('Roots changed:', roots.length);
      this.updateRoots(roots);
    };

    this.rootManager = new RootManager({
      canvas: this.canvas,
      container,
      onRootChange: onRootChangeCallback,
      minRoots: 2,
      maxRoots: 16
    });

    // Initialize the root data buffer with the default roots
    console.log('Performing initial root data update...');
    this.updateRoots(this.rootManager.getRoots());
  }

  private setupUIHandlers(): void {
    const toggleButton = document.getElementById('toggle-instructions');
    const instructions = document.getElementById('instructions');

    if (toggleButton && instructions) {
      let isVisible = true;
      toggleButton.addEventListener('click', () => {
        isVisible = !isVisible;
        instructions.style.display = isVisible ? 'block' : 'none';
        toggleButton.textContent = isVisible ? 'Hide Instructions' : 'Show Instructions';
      });
    }
  }

  private updateRoots(roots: ComplexNumber[]): void {
    // Get colors - either from rootManager or generate them if not available
    const colors = this.rootManager ? this.rootManager.getColors() :
                   roots.map((_, i) => ({ r: i === 0 ? 1 : 0, g: i === 1 ? 1 : 0, b: i === 2 ? 1 : 0 }));

    console.log('Updating roots:', roots.length, 'colors:', colors.length);
    console.log('Updating roots:', roots.length, 'colors:', colors.length);

    // Update uniform buffer with current state
    this.updateUniforms();

    // Update root buffer with proper alignment
    // 16 roots (vec4<f32>) + 16 colors (vec4<f32>)
    const rootData = new Float32Array(16 * 4 + 16 * 4); // 16*4 + 16*4 = 128 floats

    // Fill root positions (vec4<f32>, using .xy for complex numbers)
    for (let i = 0; i < Math.min(roots.length, 16); i++) {
      const baseIndex = i * 4;
      rootData[baseIndex] = roots[i].real;     // x component
      rootData[baseIndex + 1] = roots[i].imag; // y component
      rootData[baseIndex + 2] = 0.0;           // z component (unused)
      rootData[baseIndex + 3] = 0.0;           // w component (unused)
    }

    // Fill colors (vec4<f32>) starting at offset 16*4
    const colorOffset = 16 * 4;
    for (let i = 0; i < Math.min(colors.length, 16); i++) {
      const baseIndex = colorOffset + i * 4;
      rootData[baseIndex] = colors[i].r;
      rootData[baseIndex + 1] = colors[i].g;
      rootData[baseIndex + 2] = colors[i].b;
      rootData[baseIndex + 3] = 1.0; // alpha component
    }

    this.device.queue.writeBuffer(this.rootBuffer, 0, rootData);
  }

  private updateUniforms(): void {
    const uniformData = new ArrayBuffer(32);
    const uintView = new Uint32Array(uniformData);
    const floatView = new Float32Array(uniformData);

    // resolution (u32, u32)
    uintView[0] = this.canvas.width;
    uintView[1] = this.canvas.height;

    // aspect_ratio (f32)
    floatView[2] = this.viewport.aspectRatio;

    // zoom (f32)
    floatView[3] = this.viewport.zoom;

    // center (vec2<f32>)
    floatView[4] = this.viewport.center.real;
    floatView[5] = this.viewport.center.imag;

    // num_roots (u32) - safe check for rootManager
    uintView[6] = this.rootManager ? this.rootManager.getRoots().length : 3;

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  private startRenderLoop(): void {
    const render = () => {
      this.updateUniforms();

      const commandEncoder = this.device.createCommandEncoder();
      const textureView = this.context.getCurrentTexture().createView();
      const msaaView = this.msaaTexture.createView();

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: msaaView, // Render to MSAA texture
          resolveTarget: textureView, // Resolve to canvas
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 }
        }]
      });

      renderPass.setPipeline(this.pipeline);
      renderPass.setBindGroup(0, this.bindGroup);
      renderPass.draw(3, 1, 0, 0);
      renderPass.end();

      this.device.queue.submit([commandEncoder.finish()]);

      this.animationId = requestAnimationFrame(render);
    };

    render();
  }

  public destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.rootManager) {
      this.rootManager.destroy();
    }
    if (this.msaaTexture) {
      this.msaaTexture.destroy();
    }
  }
}

// Initialize the application
console.log('Creating Newton Fractal App...');
const app = new NewtonFractalApp();
console.log('App created, initializing...');
app.initialize().catch(err => {
  console.error('Failed to initialize Newton Fractal:', err);
  // Show error in the UI as well
  document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: monospace;">
    <h2>Error initializing Newton Fractal:</h2>
    <pre>${err.message}</pre>
    <p>Check the browser console for more details.</p>
  </div>`;
});
  