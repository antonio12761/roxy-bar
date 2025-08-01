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
  
  // Configurazioni sperimentali
  experimental: {
    // Nessuna configurazione sperimentale per ora
  },
};

export default nextConfig;