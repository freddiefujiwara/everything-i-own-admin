<template>
  <div class="builder-tabs sheet-tabs" role="tablist" aria-label="シート">
    <button
      v-for="sheet in sheets"
      :key="sheet.key"
      type="button"
      class="builder-tab"
      :class="{ active: current === sheet.key }"
      role="tab"
      :aria-selected="current === sheet.key"
      @click="$emit('select', sheet.key)"
    >
      {{ sheet.tabLabel }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  sheets: { type: Array, required: true },
  current: { type: String, required: true },
})
defineEmits(['select'])
</script>
