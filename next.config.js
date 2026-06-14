/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Allow larger body size for analysis reports
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  // Security headers are handled by middleware.ts
}

module.exports = nextConfig
