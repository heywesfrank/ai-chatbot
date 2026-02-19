import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // This targets ONLY your embeddable widget
        source: "/widget",
        headers: [
          {
            // Modern browsers use Content-Security-Policy
            key: "Content-Security-Policy",
            value: "frame-ancestors *", 
          },
          {
            // Older browsers rely on X-Frame-Options
            key: "X-Frame-Options",
            value: "ALLOWALL",
          }
        ],
      },
    ];
  },
};

export default nextConfig;
