# Interactive Newton Fractal

An interactive Newton fractal visualization built with WebGPU, TypeScript, and Vite. Explore the beautiful mathematical patterns of Newton's method for finding polynomial roots!

## ✨ Features

- **Interactive Root Manipulation**: Drag colored circles to move polynomial roots in real-time
- **Dynamic Root Management**: Double-click to add new roots or remove existing ones
- **Automatic Color Generation**: Uses OKHSL color space for visually distinct root colors
- **Proper Aspect Ratio Handling**: Maintains mathematical accuracy across different screen sizes
- **Mobile Support**: Works on desktop, tablets, and mobile devices with touch/pointer events
- **Real-time Rendering**: Powered by WebGPU for smooth, hardware-accelerated graphics

## 🚀 Live Demo

Visit the live demo: [https://itayfi.github.io/newton-gpt-oss/](https://itayfi.github.io/newton-gpt-oss/)

## 🎮 How to Use

- **Drag** the colored circles to move polynomial roots and see the fractal change in real-time
- **Double-click/tap** on empty space to add a new root (up to 16 maximum)
- **Double-click/tap** on a colored circle to remove that root (minimum 2 required)
- **Watch** as colors automatically update using the OKHSL color space for optimal visual distinction

## 🛠️ Development

### Prerequisites

- Node.js 18+ 
- A modern browser with WebGPU support (Chrome 113+, Edge 113+, or Firefox with WebGPU enabled)

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/newton-gpt-oss.git
   cd newton-gpt-oss
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Testing the Production Build

```bash
npm run build
npx vite preview
```

## 🚀 Deployment

This project is configured for automatic deployment to GitHub Pages using GitHub Actions.

### Setting up GitHub Pages Deployment

1. **Enable GitHub Pages** in your repository settings:
   - Go to Settings → Pages
   - Set Source to "GitHub Actions"

2. **Push to main branch**: The deployment will trigger automatically on pushes to the main branch

3. **Manual deployment**: You can also trigger deployment manually from the Actions tab

The GitHub Actions workflow will:
- Build the project using Vite
- Deploy to GitHub Pages
- Make it available at `https://yourusername.github.io/newton-gpt-oss/`

## 🏗️ Technical Details

### Architecture

- **Frontend**: TypeScript + Vite for fast development and building
- **Graphics**: WebGPU with WGSL shaders for hardware-accelerated rendering
- **Interaction**: Pointer Events API for cross-platform touch/mouse support
- **Mathematics**: Complex number arithmetic and Newton's method implementation
- **Color Theory**: OKHSL color space for perceptually uniform color distribution

### Key Components

- `src/main.ts`: Main application and WebGPU setup
- `src/RootManager.ts`: Handles interactive root manipulation
- `src/utils.ts`: Complex number utilities and coordinate transformations
- `src/fargment.wgsl`: Fragment shader implementing Newton's method
- `src/vertex.wgsl`: Vertex shader for full-screen rendering

### Browser Compatibility

- **Chrome/Edge 113+**: Full WebGPU support
- **Firefox**: Requires `dom.webgpu.enabled` flag
- **Safari**: WebGPU support coming soon

## 📚 Mathematical Background

The Newton fractal visualizes the convergence behavior of Newton's method for finding roots of polynomials. Each pixel represents a starting point in the complex plane, and the color indicates which root the iterative method converges to.

The method uses the iteration: `z_{n+1} = z_n - f(z_n)/f'(z_n)`

Where `f(z)` is the polynomial formed by the user-defined roots, and `f'(z)` is its derivative.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- Built with modern web technologies: WebGPU, TypeScript, and Vite
- Inspired by the mathematical beauty of Newton fractals
- Uses OKHSL color space for optimal color perception
