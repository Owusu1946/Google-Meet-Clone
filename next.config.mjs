import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  images: {
    remotePatterns: [
      {
        hostname: 'cdn.tailgrids.com',
      },
      {
        hostname: 'www.gstatic.com',
      },
      {
        hostname: 'img.clerk.com',
      },
    ],
  },
};

export default nextConfig;
