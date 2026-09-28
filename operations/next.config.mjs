/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value:
              "https://sih26238-student-v25-free.onrender.com",
          },
          {
            key: "Access-Control-Allow-Methods",
            value:
              "GET,POST,PATCH,PUT,DELETE,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "Accept, Content-Type, Authorization, X-Request-ID, X-Requested-With, X-Student-ID, X-Contract-Version",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Access-Control-Max-Age",
            value: "600",
          },
          {
            key: "Access-Control-Expose-Headers",
            value: "X-Request-ID",
          },
          {
            key: "Vary",
            value: "Origin",
          },
        ],
      },
    ];
  },

  poweredByHeader: false,

  reactStrictMode: true,
};

export default nextConfig;
