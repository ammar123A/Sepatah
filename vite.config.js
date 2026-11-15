import vue from '@vitejs/plugin-vue'

// Two pages: index.html is the static landing (the taste-skill kit in public/assets), app.html the Vue app
// for every other route (/:slug, /admin, /g/:token). Netlify does the same split in public/_redirects.
const appShell = {
  name: 'app-shell',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const path = req.url.split('?')[0]
      if (req.headers.accept?.includes('text/html') && path !== '/' && path !== '/index.html' && !path.includes('.')) req.url = '/app.html'
      next()
    })
  },
}

export default {
  appType: 'mpa',
  plugins: [vue(), appShell],
  build: {
    assetsDir: '_app', // public/assets holds the landing's kit; keep the app's bundles apart
    rollupOptions: { input: { index: 'index.html', app: 'app.html' } },
  },
}
