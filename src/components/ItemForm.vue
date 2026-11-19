<template>
  <section class="table-wrap">
    <h2 class="section-title">{{ title }}</h2>
    <SheetTabs
      v-if="!editing"
      :sheets="sheets"
      :current="currentSheet"
      @select="$emit('sheet', $event)"
    />
    <p v-else class="meta">{{ sheetLabel(currentSheet) }}{{ isSub ? 'を編集中' : 'のアイテムを編集中' }}</p>

    <template v-if="!isSub">
      <label class="form-label" for="f-title">商品名</label>
      <input id="f-title" v-model="form.title" type="text" />
      <label class="form-label" for="f-image">画像URL</label>
      <input id="f-image" v-model="form.image" type="url" />
      <label class="form-label" for="f-url">商品URL</label>
      <input id="f-url" v-model="form.url" type="url" />
      <div class="field-row">
        <label>価格 <input v-model="form.price" type="number" min="0" /></label>
        <label>個数 <input v-model="form.unit" type="number" min="1" /></label>
      </div>
      <label class="form-label" for="f-genre">ジャンル</label>
      <select id="f-genre" v-model="form.genre">
        <option v-for="genre in genreOptions" :key="genre" :value="genre">{{ genre }}</option>
      </select>
      <label class="form-label" for="f-comment">コメント</label>
      <textarea id="f-comment" v-model="form.comment" rows="3"></textarea>
    </template>

    <template v-else>
      <label class="form-label" for="f-service">サービス名</label>
      <input id="f-service" v-model="form.service" type="text" />
      <label class="form-label" for="f-purpose">用途</label>
      <input id="f-purpose" v-model="form.purpose" type="text" />
      <label class="form-label">入力方法</label>
      <div class="builder-tabs" role="tablist" aria-label="入力方法">
        <button
          type="button"
          class="builder-tab"
          :class="{ active: form.basis === 'yearly' }"
          role="tab"
          :aria-selected="form.basis === 'yearly'"
          @click="form.basis = 'yearly'"
        >
          年額で入力
        </button>
        <button
          type="button"
          class="builder-tab"
          :class="{ active: form.basis === 'monthly' }"
          role="tab"
          :aria-selected="form.basis === 'monthly'"
          @click="form.basis = 'monthly'"
        >
          月額で入力
        </button>
      </div>
      <label class="form-label" for="f-amount">{{ form.basis === 'monthly' ? '月額' : '年額' }}</label>
      <input id="f-amount" v-model="form.amount" type="number" min="0" />
      <label class="form-label" for="f-sub-url">URL</label>
      <input id="f-sub-url" v-model="form.url" type="url" />
    </template>

    <div class="composer-row">
      <span class="meta">{{ formStatus }}</span>
      <span class="row-actions">
        <button v-if="editing" class="theme-toggle" type="button" @click="$emit('remove')">
          削除する
        </button>
        <template v-else></template>
        <button v-if="editing" class="theme-toggle" type="button" @click="$emit('cancel')">
          編集をやめる
        </button>
        <template v-else></template>
        <button class="post-button" type="button" :disabled="saving" @click="$emit('submit')">
          {{ editing ? '更新する' : '登録する' }}
        </button>
      </span>
    </div>
  </section>
</template>

<script setup>
import SheetTabs from './SheetTabs.vue'
import { sheetLabel } from '../utils/admin.js'

defineProps({
  form: { type: Object, required: true },
  title: { type: String, required: true },
  isSub: { type: Boolean, required: true },
  editing: { type: Boolean, required: true },
  sheets: { type: Array, required: true },
  currentSheet: { type: String, required: true },
  genreOptions: { type: Array, required: true },
  formStatus: { type: String, required: true },
  saving: { type: Boolean, required: true },
})
defineEmits(['sheet', 'submit', 'cancel', 'remove'])
</script>
