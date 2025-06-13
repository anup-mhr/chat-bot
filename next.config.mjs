/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' http://localhost:5500;", // prevent your site from being embedded by others
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN", // prevent your site from being embedded by others
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff", // prevent browser from sniffing content type
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          }, // prevent your site from being embedded by others

          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin", // prevent your site from being embedded by others
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "same-origin", // prevent your site from being embedded by others
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains", //  Forces browsers to always use HTTPS. only works on HTTPS
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), fullscreen=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
