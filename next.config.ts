import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    // Explicitly set the root to the current directory
    root: __dirname,
  },
}

export default nextConfig
