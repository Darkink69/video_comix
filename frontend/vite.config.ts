import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});

// export default defineConfig({
//   plugins: [tailwindcss(), react()],
//   server: {
//     port: 3000,
//     proxy: {
//       '/api': {
//         target: 'http://localhost:5000',
//         changeOrigin: true,
//         // Логирование прокси
//         configure: (proxy) => {
//           proxy.on('error', (err) => {
//             console.log('Proxy error:', err);
//           });
//           proxy.on('proxyReq', (proxyReq, req) => {
//             console.log('Proxy request:', req.method, req.url);
//           });
//           proxy.on('proxyRes', (proxyRes, req) => {
//             console.log('Proxy response:', proxyRes.statusCode, req.url);
//           });
//         }
//       }
//     }
//   }
// })
