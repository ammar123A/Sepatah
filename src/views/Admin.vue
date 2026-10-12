<script setup>
// Mato only. Login + event list. Data access is enforced by RLS (is_admin()), this page is just UI.
import { ref } from 'vue'
import { sb, isAdmin } from '../lib.js'

const state = ref('loading') // loading | login | denied | ok
const email = ref('')
const password = ref('')
const err = ref('')
const busy = ref(false)
const events = ref([])

async function load() {
  const { data: { session } } = await sb.auth.getSession()
  if (!session) return (state.value = 'login')
  if (!(await isAdmin())) return (state.value = 'denied')
  const { data, error } = await sb.from('events').select('id, slug, bride, groom, event_date, published').order('event_date', { ascending: false })
  err.value = error?.message || ''
  events.value = data || []
  state.value = 'ok'
}
load()

async function login() {
  busy.value = true
  err.value = ''
  const { error } = await sb.auth.signInWithPassword({ email: email.value, password: password.value })
  busy.value = false
  if (error) err.value = error.message
  else load()
}
async function logout() {
  await sb.auth.signOut()
  state.value = 'login'
}
</script>

<template>
  <div class="admin">
    <header class="bar">
      <div class="mark">Sepatah</div>
      <button v-if="state === 'ok' || state === 'denied'" class="linkbtn" @click="logout">Log out</button>
    </header>

    <div v-if="state === 'loading'" class="rows"><div class="skel" style="height: 52px" v-for="i in 3" :key="i"></div></div>

    <form v-else-if="state === 'login'" class="stack" style="max-width: 360px" @submit.prevent="login">
      <h1 class="h1">Admin</h1>
      <label class="field"><span>Email</span><input v-model="email" type="email" autocomplete="username" required /></label>
      <label class="field"><span>Password</span><input v-model="password" type="password" autocomplete="current-password" required /></label>
      <p v-if="err" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ err }}</p>
      <button class="btn primary" :disabled="busy">{{ busy ? 'Logging in' : 'Log in' }}</button>
    </form>

    <div v-else-if="state === 'denied'" class="state light">
      <div class="badge"><svg class="ic"><use href="#i-alert" /></svg></div>
      <h2>Not an admin</h2>
      <p>This account is not in admin_users.</p>
    </div>

    <template v-else>
      <div class="row" style="justify-content: space-between">
        <h1 class="h1">Events</h1>
        <RouterLink class="btn primary" to="/admin/e/new">New event</RouterLink>
      </div>
      <p v-if="err" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ err }}</p>
      <div v-if="!events.length && !err" class="state light">
        <div class="badge"><svg class="ic"><use href="#i-calendar" /></svg></div>
        <h2>No events yet</h2>
        <p>Create the first wedding to get its invitation and QR links.</p>
      </div>
      <ul v-else class="list">
        <li v-for="(e, i) in events" :key="e.id">
          <RouterLink :to="`/admin/e/${e.id}`" :style="{ animationDelay: i * 50 + 'ms' }">
            <span>{{ e.bride }} &amp; {{ e.groom }} <small>/{{ e.slug }}</small></span>
            <span class="row"><small>{{ e.event_date }}</small><span class="tag" :class="{ on: e.published }">{{ e.published ? 'Published' : 'Draft' }}</span></span>
          </RouterLink>
        </li>
      </ul>
    </template>
  </div>
</template>
