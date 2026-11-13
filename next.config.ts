import type {NextConfig} from 'next'

// GitHub Pages publica el proyecto bajo /Club_OS.
// Vercel sirve el proyecto desde la raíz del dominio.
const isVercel = process.env.VERCEL === '1'
const basePath = isVercel ? '' : process.env.NODE_ENV === 'production' ? '/Club_OS' : ''

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
}

export default nextConfig
