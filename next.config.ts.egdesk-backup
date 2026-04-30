import type { NextConfig } from "next";

console.log('🔍 DEBUG next.config: EGDESK_BASE_PATH env var =', process.env.EGDESK_BASE_PATH);

/**
 * 🔍 Next.js Configuration
 * Handles BasePath and AssetPrefix for tunneled or proxied environments.
 */
const nextConfig: NextConfig = {
  // Only use basePath in production mode, not in dev mode
  basePath: process.env.NODE_ENV === 'development' ? '' : (process.env.EGDESK_BASE_PATH || ''),
  assetPrefix: process.env.NODE_ENV === 'development' ? '' : (process.env.EGDESK_BASE_PATH || ''),
  
  
  typescript: {
    // Ignore build errors for auto-generated or experimental files
    ignoreBuildErrors: true,
  },
  
  eslint: {
    // Ignore lint errors during build
    ignoreDuringBuilds: true,
  },
  
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
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
