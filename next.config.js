/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // This targets ONLY your embeddable widget
        source: "/widget",
        headers: [
          {
            // Modern browsers use Content-Security-Policy
            key: "Content-Security-Policy",
            value: "frame-ancestors *", // The '*' means "allow any domain to embed this"
          },
          {
            // Older browsers rely on X-Frame-Options
            // We override the default "DENY" to allow embedding
            key: "X-Frame-Options",
            value: "ALLOWALL",
          }
        ],
      },
    ];
  },
};

module.exports = nextConfig;
