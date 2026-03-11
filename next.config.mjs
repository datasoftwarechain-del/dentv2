/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options",    value: "nosniff"         },
  { key: "X-Frame-Options",           value: "SAMEORIGIN"      },
  { key: "X-XSS-Protection",          value: "1; mode=block"   },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com",
      "frame-src 'none'",
      "object-src 'none'",
    ].join("; "),
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
    async headers() {
        return [{ source: "/(.*)", headers: securityHeaders }];
    },

    // Remove X-Powered-By header
    poweredByHeader: false,

    // Enable gzip/brotli compression
    compress: true,

    // Turbopack configuration
    turbopack: {
        root: process.cwd(),
    },

    // Compiler options
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production',
    },

    // Image optimization
    images: {
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    },

    // Experimental features for better performance
    experimental: {
        // Client-side router cache: keep dynamic pages cached for 30 s so that
        // navigating back to a dashboard section is instant instead of re-fetching.
        staleTimes: {
            dynamic: 30,   // seconds — dashboard pages (server-rendered, auth-gated)
            static: 180,   // seconds — fully-static pages
        },

        optimizePackageImports: [
            'lucide-react',
            'framer-motion',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-switch',
            '@radix-ui/react-accordion',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-progress',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-select',
            '@radix-ui/react-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
            '@radix-ui/react-separator',
            '@radix-ui/react-tabs',
            '@radix-ui/react-popover',
            'recharts',
            'class-variance-authority',
            'date-fns',
            'sonner',
            'react-day-picker',
            'react-hook-form',
            '@iconify/react',
        ],
    },
};

export default nextConfig;
