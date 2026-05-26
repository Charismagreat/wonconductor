import type { NextConfig } from "next";

/**
 * 🔍 Automatically detect local IPv4 addresses to allow LAN access.
 */
const getLocalIPs = () => {
  try {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const ips = ['localhost', '127.0.0.1'];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
          const parts = iface.address.split('.');
          if (parts.length === 4) {
            ips.push(`${parts[0]}.${parts[1]}.${parts[2]}.*`);
          }
        }
      }
    }
    return Array.from(new Set(ips));
  } catch (e) {
    return ['localhost', '127.0.0.1', '192.168.0.*', '192.168.1.*', '10.0.0.*'];
  }
};

console.log('🔍 DEBUG next.config: EGDESK_BASE_PATH env var =', process.env.EGDESK_BASE_PATH);

/**
 * 🔍 Next.js Configuration
 * Handles BasePath and AssetPrefix for tunneled or proxied environments.
 */
const nextConfig: NextConfig = {
  eslint: {
    // Always skip ESLint errors to prevent blocking on auto-generated files
    ignoreDuringBuilds: true,
  },
  // Allow LAN/IP access to the dev server (Next.js 15+)
  allowedDevOrigins: getLocalIPs(),
  // Only use basePath in production mode, not in dev mode
  basePath: process.env.NODE_ENV === 'development' ? '' : (process.env.EGDESK_BASE_PATH || ''),
  assetPrefix: process.env.NODE_ENV === 'development' ? '' : (process.env.EGDESK_BASE_PATH || ''),
  
  
  typescript: {
    // Ignore build errors for auto-generated or experimental files
    ignoreBuildErrors: true,
  },
  
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: [
        'localhost:3000',
        '127.0.0.1:3000',
        '*.loca.lt',
        '*.ngrok.io',
        '*.ngrok-free.app',
        '*.trycloudflare.com',
        '*.gitpod.io',
        '*.tryhook.io',
        '*.localto.net'
      ]
    }
  }
};

console.log('🔍 DEBUG next.config: Final config basePath =', nextConfig.basePath);
console.log('🔍 DEBUG next.config: Final config assetPrefix =', nextConfig.assetPrefix);


console.log('🔍 [SYSTEM DIAGNOSTIC] next.config active:', {
  basePath: nextConfig.basePath,
  assetPrefix: nextConfig.assetPrefix,
  nodeEnv: process.env.NODE_ENV
});

export default nextConfig;
