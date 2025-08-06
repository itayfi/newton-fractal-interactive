import { defineConfig } from 'vite'

export default defineConfig({
  // Set the base path for GitHub Pages deployment
  // This will be overridden by the repository name when deployed
  base: process.env.NODE_ENV === 'production' ? '/newton-gpt-oss/' : '/',
  
  build: {
    // Ensure assets are properly referenced
    assetsDir: 'assets',
    
    // Generate source maps for debugging
    sourcemap: true,
    
    // Optimize for modern browsers that support WebGPU
    target: 'es2022',
    
    rollupOptions: {
      output: {
        // Ensure consistent file naming
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  
  // Ensure proper MIME types for WGSL files
  assetsInclude: ['**/*.wgsl'],
  
  // Development server configuration
  server: {
    // Enable HTTPS for WebGPU development (some features require secure context)
    // https: true,
    port: 5173,
    host: true // Allow external connections
  },
  
  // Preview server configuration (for testing production builds)
  preview: {
    port: 4173,
    host: true
  }
})
