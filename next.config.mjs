/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disabilita completamente il logging delle route in development
  webpack: (config, { dev }) => {
    if (dev) {
      // Sovrascrivi il logger di webpack
      config.infrastructureLogging = {
        level: 'error',
      };
    }
    return config;
  },
  
  // Disabilita il logging delle richieste HTTP
  httpAgentOptions: {
    keepAlive: false,
  },
  
  // Permetti accesso da dispositivi esterni in development
  experimental: {
    allowedDevOrigins: ['http://192.168.1.54:3000', 'http://localhost:3000'],
  },
};

export default nextConfig;