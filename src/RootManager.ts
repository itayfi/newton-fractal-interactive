import {
  ComplexNumber,
  type RootElement,
  type RootManagerConfig,
  type ViewportConfig,
  type RGB,
  generateRootColors,
  screenToComplex,
  complexToScreen,
  DEFAULT_ROOTS
} from './utils.js';

export class RootManager {
  private roots: RootElement[] = [];
  private config: RootManagerConfig;
  private viewport: ViewportConfig = {
    zoom: 1.0,
    center: new ComplexNumber(0, 0),
    aspectRatio: 1.0
  };
  private dragState: {
    isDragging: boolean;
    rootId: string | null;
    startPos: { x: number; y: number };
    offset: { x: number; y: number };
  } = {
    isDragging: false,
    rootId: null,
    startPos: { x: 0, y: 0 },
    offset: { x: 0, y: 0 }
  };

  constructor(config: RootManagerConfig) {
    this.config = config;
    console.log('RootManager constructor called');

    // Use initial viewport if provided, otherwise calculate from canvas
    if (config.initialViewport) {
      this.viewport = { ...config.initialViewport };
      console.log('Using provided initial viewport:', this.viewport);
    } else {
      this.updateViewport();
      console.log('Calculated viewport from canvas:', this.viewport);
    }

    this.initializeDefaultRoots();
    this.setupEventListeners();
    console.log('RootManager initialized with', this.roots.length, 'roots');

    // Call the initial callback after everything is set up
    this.notifyRootChange();
  }

  private initializeDefaultRoots(): void {
    const colors = generateRootColors(DEFAULT_ROOTS.length);

    DEFAULT_ROOTS.forEach((root, index) => {
      this.addRootElement(root, colors[index]);
    });

    // Don't call notifyRootChange here - it will be called after constructor completes
  }

  private addRootElement(complex: ComplexNumber, color: RGB): RootElement {
    const id = `root-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    // Create HTML element for the root
    const element = document.createElement('div');
    element.className = 'root-marker';
    element.id = id;
    element.style.cssText = `
      position: absolute;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)});
      border: 2px solid white;
      cursor: grab;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      transform: translate(-50%, -50%);
      transition: transform 0.1s ease;
    `;
    
    // Add hover effects
    element.addEventListener('mouseenter', () => {
      element.style.transform = 'translate(-50%, -50%) scale(1.2)';
    });

    element.addEventListener('mouseleave', () => {
      if (!this.dragState.isDragging || this.dragState.rootId !== id) {
        element.style.transform = 'translate(-50%, -50%) scale(1.0)';
      }
    });

    // Add double-click handler for removal
    element.addEventListener('dblclick', (e) => {
      e.stopPropagation(); // Prevent canvas double-click handler
      this.removeRoot(id);
    });

    this.config.container.appendChild(element);

    const rootElement: RootElement = {
      id,
      complex,
      color,
      element,
      isDragging: false
    };

    this.roots.push(rootElement);
    this.updateRootPosition(rootElement);
    
    return rootElement;
  }

  private setupEventListeners(): void {
    // Pointer down - start dragging (works for mouse, touch, and pen)
    this.config.container.addEventListener('pointerdown', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('root-marker')) {
        // Capture the pointer to ensure we receive all subsequent events
        target.setPointerCapture(e.pointerId);
        this.startDrag(target.id, e.clientX, e.clientY);
        e.preventDefault();
      }
    });

    // Pointer move - handle dragging
    document.addEventListener('pointermove', (e) => {
      if (this.dragState.isDragging) {
        this.handleDrag(e.clientX, e.clientY);
        e.preventDefault();
      }
    });

    // Pointer up - end dragging
    document.addEventListener('pointerup', (e) => {
      if (this.dragState.isDragging) {
        // Release pointer capture
        const target = document.getElementById(this.dragState.rootId!);
        if (target) {
          target.releasePointerCapture(e.pointerId);
        }
        this.endDrag();
      }
    });

    // Pointer cancel - handle interruptions (e.g., system gestures)
    document.addEventListener('pointercancel', (e) => {
      if (this.dragState.isDragging) {
        const target = document.getElementById(this.dragState.rootId!);
        if (target) {
          target.releasePointerCapture(e.pointerId);
        }
        this.endDrag();
      }
    });

    // Double click - add new roots (removal is handled by individual root elements)
    this.config.canvas.addEventListener('dblclick', (e) => {
      const rect = this.config.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Add new root at clicked position
      this.addRootAtPosition(x, y);
    });

    // Window resize - update viewport
    window.addEventListener('resize', () => {
      this.updateViewport();
      this.updateAllRootPositions();
    });
  }

  private startDrag(rootId: string, clientX: number, clientY: number): void {
    const root = this.roots.find(r => r.id === rootId);
    if (!root) return;

    const elementRect = root.element.getBoundingClientRect();

    this.dragState = {
      isDragging: true,
      rootId,
      startPos: { x: clientX, y: clientY },
      offset: {
        x: elementRect.left + elementRect.width / 2 - clientX,
        y: elementRect.top + elementRect.height / 2 - clientY
      }
    };

    root.isDragging = true;
    root.element.style.cursor = 'grabbing';
    root.element.style.transform = 'translate(-50%, -50%) scale(1.2)';
    root.element.style.zIndex = '1001';
  }

  private handleDrag(clientX: number, clientY: number): void {
    if (!this.dragState.isDragging || !this.dragState.rootId) return;

    const root = this.roots.find(r => r.id === this.dragState.rootId);
    if (!root) return;

    const canvasRect = this.config.canvas.getBoundingClientRect();
    
    // Calculate new position relative to canvas
    const canvasX = clientX - canvasRect.left;
    const canvasY = clientY - canvasRect.top;
    
    // Convert to complex number
    const newComplex = screenToComplex(
      canvasX, 
      canvasY, 
      this.config.canvas.width / window.devicePixelRatio,
      this.config.canvas.height / window.devicePixelRatio,
      this.viewport
    );

    // Update root complex value
    root.complex = newComplex;
    
    // Update visual position
    this.updateRootPosition(root);
    
    // Notify of change for real-time updates
    this.notifyRootChange();
  }

  private endDrag(): void {
    if (!this.dragState.isDragging || !this.dragState.rootId) return;

    const root = this.roots.find(r => r.id === this.dragState.rootId);
    if (root) {
      root.isDragging = false;
      root.element.style.cursor = 'grab';
      root.element.style.transform = 'translate(-50%, -50%) scale(1.0)';
      root.element.style.zIndex = '1000';
    }

    this.dragState = {
      isDragging: false,
      rootId: null,
      startPos: { x: 0, y: 0 },
      offset: { x: 0, y: 0 }
    };
  }



  private addRootAtPosition(x: number, y: number): void {
    if (this.roots.length >= this.config.maxRoots) return;

    const complex = screenToComplex(
      x, 
      y, 
      this.config.canvas.width / window.devicePixelRatio,
      this.config.canvas.height / window.devicePixelRatio,
      this.viewport
    );

    // Regenerate colors for all roots
    const colors = generateRootColors(this.roots.length + 1);
    
    // Update existing root colors
    this.roots.forEach((root, index) => {
      root.color = colors[index];
      this.updateRootColor(root);
    });

    // Add new root
    this.addRootElement(complex, colors[this.roots.length]);
    this.notifyRootChange();
  }

  private removeRoot(rootId: string): void {
    if (this.roots.length <= this.config.minRoots) return;

    const rootIndex = this.roots.findIndex(r => r.id === rootId);
    if (rootIndex === -1) return;

    // Remove element from DOM
    this.roots[rootIndex].element.remove();
    
    // Remove from array
    this.roots.splice(rootIndex, 1);

    // Regenerate colors for remaining roots
    const colors = generateRootColors(this.roots.length);
    this.roots.forEach((root, index) => {
      root.color = colors[index];
      this.updateRootColor(root);
    });

    this.notifyRootChange();
  }

  private updateRootColor(root: RootElement): void {
    const color = root.color;
    root.element.style.backgroundColor = 
      `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
  }

  private updateRootPosition(root: RootElement): void {
    const screenPos = complexToScreen(
      root.complex,
      this.config.canvas.width / window.devicePixelRatio,
      this.config.canvas.height / window.devicePixelRatio,
      this.viewport
    );

    root.element.style.left = `${screenPos.x}px`;
    root.element.style.top = `${screenPos.y}px`;
  }

  private updateAllRootPositions(): void {
    this.roots.forEach(root => this.updateRootPosition(root));
  }

  private updateViewport(): void {
    const canvas = this.config.canvas;
    this.viewport.aspectRatio = canvas.clientWidth / canvas.clientHeight;
  }

  private notifyRootChange(): void {
    const complexRoots = this.roots.map(r => r.complex);
    this.config.onRootChange(complexRoots);
  }

  // Public methods
  public getRoots(): ComplexNumber[] {
    return this.roots.map(r => r.complex);
  }

  public getColors(): RGB[] {
    return this.roots.map(r => r.color);
  }

  public setViewport(viewport: Partial<ViewportConfig>): void {
    this.viewport = { ...this.viewport, ...viewport };
    this.updateAllRootPositions();
  }

  public destroy(): void {
    this.roots.forEach(root => root.element.remove());
    this.roots = [];
  }
}
