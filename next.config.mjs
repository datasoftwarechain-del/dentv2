/** @type {import('next').NextConfig} */
const nextConfig = {
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
        optimizePackageImports: [
            'lucide-react',
            'framer-motion',
            '@radix-ui/react-dropdown-menu',
            'date-fns',
            'sonner',
        ],
    },
};

export default nextConfig;
