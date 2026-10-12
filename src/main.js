import { createApp, h } from 'vue'
import { createRouter, createWebHistory, RouterView } from 'vue-router'
import { sb, isAdmin } from './lib.js'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/Home.vue') },
    { path: '/admin', component: () => import('./views/Admin.vue') },
    { path: '/admin/e/:id', component: () => import('./views/AdminEvent.vue'), meta: { admin: true } },
    { path: '/g/:token', component: () => import('./views/Gallery.vue') },
    { path: '/:slug', component: () => import('./views/Invite.vue') },
    { path: '/:slug/tetamu', component: () => import('./views/Guestbook.vue') },
  ],
})

// UX only: RLS is what actually protects admin data
router.beforeEach(async (to) => {
  if (!to.meta.admin) return
  const { data: { session } } = await sb.auth.getSession()
  if (!session || !(await isAdmin())) return '/admin'
})

// key by path so /admin/e/new → /admin/e/<id> remounts the page
createApp({ render: () => h(RouterView, null, { default: ({ Component, route }) => Component && h(Component, { key: route.path }) }) })
  .use(router)
  .mount('#app')
