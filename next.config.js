/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";

    // Next.js's dev server (Fast Refresh / webpack HMR runtime) genuinely
    // requires 'unsafe-eval' to function — without it, the dev server's own
    // client-side JavaScript runtime fails to execute at all, which
    // silently breaks every client component's interactivity (including,
    // very concretely, this app's login/register form submit handlers —
    // this exact CSP was the real root cause of a login bug that looked
    // unrelated). This relaxation is dev-only; production builds (where
    // Fast Refresh doesn't exist) keep the strict policy with no
    // 'unsafe-eval'.
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";

    return [
      {
        // Applies to every route in the app
        source: "/:path*",
        headers: [
          // Prevents the site from being embedded in an iframe on another origin (clickjacking defense)
          { key: "X-Frame-Options", value: "DENY" },
          // Stops browsers from MIME-sniffing a response away from its declared Content-Type
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Limits how much referrer information is sent on cross-origin navigation
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restricts powerful browser features FinMate doesn't use
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Baseline Content-Security-Policy: same-origin by default, inline styles allowed
          // for Tailwind's injected styles, no third-party script origins.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
