/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  // Static export only for production builds — dev needs rewrites for API proxy
  ...(!isDev ? { output: 'export' } : {}),
  trailingSlash: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },
}
module.exports = nextConfig
