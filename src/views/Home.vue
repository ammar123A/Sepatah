<script setup>
// Public front door at "/". Guests arrive on /:slug; this only says what Sepatah is.
import { t, LangToggle } from '../i18n.js'

const features = [['i-calendar', 'homeF1'], ['i-video', 'homeF2'], ['i-camera', 'homeF3']]
</script>

<template>
  <div class="shell">
    <div class="app">
      <header class="bar">
        <div class="mark">Sepatah</div>
        <LangToggle />
      </header>
      <main class="screen">
        <div class="hero">
          <p class="eyebrow">{{ t('homeEyebrow') }}</p>
          <h1 class="h1">{{ t('homeTitle') }}</h1>
          <div class="orn"></div>
          <p class="lede">{{ t('homeLede') }}</p>
        </div>
        <ul class="list">
          <li v-for="[icon, key] in features" :key="key" class="item" style="justify-content: flex-start">
            <svg class="ic"><use :href="`#${icon}`" /></svg>{{ t(key) }}
          </li>
        </ul>
        <footer class="made">{{ t('madeWith') }} <span class="mark sm">Sepatah</span></footer>
      </main>
    </div>
  </div>
</template>
