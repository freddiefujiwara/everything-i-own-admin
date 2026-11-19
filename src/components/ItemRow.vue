<template>
  <div class="alarm-row" :class="{ flagged: Boolean(entry.flag) }">
    <div v-if="sub" class="item-main">
      <div>
        <div class="item-title"><a v-if="entry.url" class="item-link" :href="entry.url" target="_blank" rel="noopener noreferrer">{{ name }}</a><template v-else>{{ name }}</template><span v-if="sheetBadge" class="sheet-badge">{{ sheetLabel(entry.sheet) }}</span><template v-else></template><span v-if="entry.flag" class="flag-badge">整理対象</span><template v-else></template></div>
        <div v-if="entry.purpose" class="alarm-commands">{{ entry.purpose }}</div>
        <template v-else></template>
        <div class="alarm-commands">{{ subscriptionCost(entry) }}</div>
        <div v-if="entry.url" class="alarm-commands">{{ entry.url }}</div>
        <template v-else></template>
      </div>
    </div>
    <div v-else class="item-main">
      <img
        class="item-thumb"
        :src="entry.image || FALLBACK_IMAGE_URL"
        alt=""
        loading="lazy"
        @error="onThumbError"
      />
      <div>
        <div class="item-title"><a v-if="entry.url" class="item-link" :href="entry.url" target="_blank" rel="noopener noreferrer">{{ name }}</a><template v-else>{{ name }}</template><span v-if="sheetBadge" class="sheet-badge">{{ sheetLabel(entry.sheet) }}</span><template v-else></template><span v-if="entry.flag" class="flag-badge">整理対象</span><template v-else></template></div>
        <div class="alarm-commands">{{ itemMeta(entry) }}</div>
        <div v-if="entry.url" class="alarm-commands">{{ entry.url }}</div>
        <template v-else></template>
      </div>
    </div>
    <div class="row-actions">
      <button
        type="button"
        class="icon-btn flag-btn"
        :class="{ active: Boolean(entry.flag) }"
        title="整理対象"
        aria-label="整理対象フラグ"
        :aria-pressed="Boolean(entry.flag)"
        @click="$emit('toggle-flag', entry)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
      </button>
      <button
        v-if="editable"
        type="button"
        class="icon-btn"
        title="編集"
        aria-label="編集"
        @click="$emit('edit', entry)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
      </button>
      <template v-else></template>
      <button
        v-if="editable"
        type="button"
        class="icon-btn"
        title="削除"
        aria-label="削除"
        @click="$emit('remove', entry)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
      <template v-else></template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { FALLBACK_IMAGE_URL } from '../constants/app.js'
import { itemMeta, sheetLabel, subscriptionCost } from '../utils/admin.js'

const props = defineProps({
  entry: { type: Object, required: true },
  sub: { type: Boolean, default: false },
  sheetBadge: { type: Boolean, default: false },
  editable: { type: Boolean, default: true },
})
defineEmits(['toggle-flag', 'edit', 'remove'])

const name = computed(() => (props.sub ? props.entry.service : props.entry.title))

const onThumbError = (event) => {
  const img = event.target
  if (img.src !== FALLBACK_IMAGE_URL) {
    img.src = FALLBACK_IMAGE_URL
  }
}
</script>
