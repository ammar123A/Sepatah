<script setup>
// Camera wouldn't open: say why in terms of this phone, and lead with the way round it (the phone's own camera / gallery).
import { ref, computed } from 'vue'
import { t } from './i18n.js'
import { inApp, isIOS, isAndroid, chromeUrl } from './lib.js'

const props = defineProps({ err: String, fallback: String })
defineEmits(['retry', 'fallback'])
const why = computed(() => inApp ? 'camInApp' : props.err === 'NotAllowedError' ? (isIOS ? 'camDeniedIOS' : 'camDeniedAndroid') : 'errBody')
const copied = ref(false)
async function copy() {
  await navigator.clipboard?.writeText(location.href).catch(() => {})
  copied.value = true
}
</script>

<template>
  <div class="state light cam-err" role="alert">
    <div class="badge"><svg class="ic"><use href="#i-alert" /></svg></div>
    <h2>{{ t('errTitle') }}</h2>
    <p>{{ t(why) }}</p>
    <a v-if="inApp && isAndroid" class="btn primary" :href="chromeUrl()">{{ t('openChrome') }}</a>
    <button class="btn" :class="{ primary: !(inApp && isAndroid) }" @click="$emit('fallback')">{{ fallback }}</button>
    <button v-if="inApp && !isAndroid" class="linkbtn" @click="copy">{{ t(copied ? 'copied' : 'copyLink') }}</button>
    <button class="linkbtn" @click="$emit('retry')">{{ t('retry') }}</button>
  </div>
</template>
