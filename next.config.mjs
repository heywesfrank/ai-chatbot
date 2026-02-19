/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // This targets ONLY your embeddable widget
        source: "/widget",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors * https: http:;", 
          }
        ],
      },
    ];
  },
};

export default nextConfig;
