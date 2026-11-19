<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ALL_TAB, GOOGLE_CLIENT_ID, SHEETS, sheetKind } from './constants/app.js'
import { useAdmin } from './composables/useAdmin.js'
import ItemForm from './components/ItemForm.vue'
import ItemRow from './components/ItemRow.vue'
import SheetTabs from './components/SheetTabs.vue'
import {
  emptyItem,
  emptySubscription,
  filterFlagged,
  formFromItem,
  formFromSubscription,
  shareLinkView,
} from './utils/admin.js'
import { THEME_KEY, applyTheme, nextTheme, resolveTheme } from './theme.js'
import {
  formatShareExpiry,
  formatShareRemaining,
  shareSecondsLeft,
} from './share.js'

const admin = useAdmin()
const {
  phase,
  email,
  isShareSession,
  shareExpiresAt,
  currentSheet,
  items,
  subscriptions,
  combined,
  genres,
  loading,
  listStatus,
  gateError,
} = admin

const tab = ref('list')
const flagOnly = ref(false)
const themeButton = ref(null)
const theme = ref(resolveTheme(localStorage.getItem(THEME_KEY)))

const applyCurrentTheme = () => {
  applyTheme(document.documentElement, themeButton.value, theme.value)
}

const toggleTheme = () => {
  theme.value = nextTheme(theme.value)
  localStorage.setItem(THEME_KEY, theme.value)
  applyCurrentTheme()
}

const shareBanner = computed(() => {
  if (!isShareSession.value || !shareExpiresAt.value) {
    return ''
  }
  const remaining = formatShareRemaining(shareSecondsLeft(shareExpiresAt.value, Date.now()))
  return `一時アクセスリンクで利用中（${formatShareExpiry(shareExpiresAt.value)} まで有効、${remaining}）`
})

// --- Entry form (登録 tab doubles as the edit form) ---
// The form shape follows the current sheet's kind: item fields for
// the item sheets, subscription fields for the subscriptions sheet.
const isSubForm = computed(() => sheetKind(currentSheet.value) === 'subscriptions')
const blankForm = () => (isSubForm.value ? emptySubscription() : emptyItem())
const form = ref(emptyItem())
const editingRow = ref(null)
// True while an edit opened from the cross-sheet (すべて) view is
// in flight: the form works on the entry's own sheet and returns
// to the cross-sheet view when it closes.
const editFromAll = ref(false)
const formStatus = ref('')
const saving = ref(false)
const notice = ref('')

// Genre dropdown options: the collected genres, plus the edited
// entry's own genre when it is not among them (legacy values stay
// selectable instead of being silently replaced).
const genreOptions = computed(() => {
  const options = [...genres.value]
  const current = form.value.genre
  if (current && !options.includes(current)) {
    options.push(current)
  }
  return options
})

// The create/edit form covers only the writable sheets; the ROOM
// tab is read-only, so it never appears among the form's sheets.
const formSheets = SHEETS.filter((sheet) => sheet.kind !== 'room')

// The list's tab bar: the cross-sheet すべて view first, then the
// sheets themselves.
const listSheets = [ALL_TAB, ...SHEETS]

const openCreate = async () => {
  if (!formSheets.some((sheet) => sheet.key === currentSheet.value)) {
    await admin.selectSheet(formSheets[0].key)
  }
  editingRow.value = null
  form.value = blankForm()
  if (!isSubForm.value && genres.value.length > 0) {
    form.value.genre = genres.value[0]
  }
  formStatus.value = ''
  tab.value = 'form'
}

const openEdit = async (entry) => {
  // The form is bound to one sheet, so an edit opened from the
  // cross-sheet view first moves to the entry's own sheet; closing
  // the form then returns to the cross-sheet view.
  editFromAll.value = currentSheet.value === ALL_TAB.key
  if (editFromAll.value) {
    await admin.selectSheet(entry.sheet)
  }
  editingRow.value = entry.row
  form.value = isSubForm.value ? formFromSubscription(entry) : formFromItem(entry)
  formStatus.value = ''
  tab.value = 'form'
}

const backToAllIfNeeded = async () => {
  if (editFromAll.value) {
    editFromAll.value = false
    await admin.selectSheet(ALL_TAB.key)
  }
}

const cancelEdit = async () => {
  editingRow.value = null
  form.value = blankForm()
  formStatus.value = ''
  await backToAllIfNeeded()
  tab.value = 'list'
}

// Switching sheets from the create form resets the form to the new
// sheet kind's blank shape.
// The form's sheet pills render only in create mode, so switching
// sheets there always resets the form.
const onFormSheet = async (key) => {
  await admin.selectSheet(key)
  form.value = blankForm()
  if (!isSubForm.value && genres.value.length > 0) {
    form.value.genre = genres.value[0]
  }
}

const onListSheet = async (key) => {
  notice.value = ''
  await admin.selectSheet(key)
}

const submit = async () => {
  saving.value = true
  formStatus.value = ''
  try {
    const res =
      editingRow.value === null
        ? await admin.createItem({ ...form.value })
        : await admin.updateItem(editingRow.value, { ...form.value })
    if (res.ok) {
      editingRow.value = null
      form.value = blankForm()
      await backToAllIfNeeded()
      tab.value = 'list'
    } else {
      formStatus.value = res.error || '保存に失敗しました'
    }
  } catch {
    formStatus.value = '保存に失敗しました'
  } finally {
    saving.value = false
  }
}

const remove = async (entry) => {
  // Combined-view entries carry their own sheet and kind; per-sheet
  // rows fall back to the current sheet.
  const sheet = entry.sheet || currentSheet.value
  const name = sheet === 'subscriptions' ? entry.service : entry.title
  if (!window.confirm(`「${name}」を削除しますか？`)) {
    return
  }
  const res = await admin.deleteItem(entry.row, sheet)
  notice.value = res.ok ? '削除しました' : res.error || '削除に失敗しました'
}

// The edit form carries its own delete button, mirroring the list.
const removeFromForm = async () => {
  const name = isSubForm.value ? form.value.service : form.value.title
  if (!window.confirm(`「${name}」を削除しますか？`)) {
    return
  }
  const res = await admin.deleteItem(editingRow.value)
  if (res.ok) {
    notice.value = '削除しました'
    editingRow.value = null
    form.value = blankForm()
    formStatus.value = ''
    await backToAllIfNeeded()
    tab.value = 'list'
  } else {
    formStatus.value = res.error || '削除に失敗しました'
  }
}

// The list filter: 整理対象のみ narrows the current sheet's rows to
// the flagged ones.
const visibleItems = computed(() => filterFlagged(items.value, flagOnly.value))
const visibleSubscriptions = computed(() =>
  filterFlagged(subscriptions.value, flagOnly.value),
)
const visibleCombined = computed(() => filterFlagged(combined.value, flagOnly.value))

const toggleFlag = async (entry) => {
  const res = await admin.setFlag(entry, !entry.flag)
  if (!res.ok) {
    notice.value = res.error || 'フラグの更新に失敗しました'
  }
}

const formTitle = computed(() => {
  if (isSubForm.value) {
    return editingRow.value === null ? '新しいサブスクリプション' : 'サブスクリプションを編集'
  }
  return editingRow.value === null ? '新しいアイテム' : 'アイテムを編集'
})

const listTitle = computed(() => {
  if (currentSheet.value === 'all') {
    return 'すべての持ち物・サブスクリプション'
  }
  return sheetKind(currentSheet.value) === 'subscriptions'
    ? '登録中のサブスクリプション'
    : '登録中のアイテム'
})

// --- Share link management (owner only, same as the alarm site) ---
const issuedShare = ref(null)
const shareError = ref('')

const shareView = computed(() =>
  shareLinkView(
    issuedShare.value,
    `${window.location.origin}${import.meta.env.BASE_URL}`,
    Date.now(),
  ),
)
const shareUrl = computed(() => shareView.value.url)
const shareRemaining = computed(() => shareView.value.remaining)
const shareExpires = computed(() => shareView.value.expires)

const issue = async () => {
  shareError.value = ''
  try {
    const res = await admin.issueShare()
    if (res.ok) {
      issuedShare.value = res
    } else {
      shareError.value = res.error || '発行に失敗しました'
    }
  } catch {
    shareError.value = '発行に失敗しました'
  }
}

const revoke = async () => {
  shareError.value = ''
  try {
    const res = await admin.revokeShare()
    if (res.ok) {
      issuedShare.value = null
    } else {
      shareError.value = res.error || '無効化に失敗しました'
    }
  } catch {
    shareError.value = '無効化に失敗しました'
  }
}

const copyShareUrl = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
  } catch {
    shareError.value = 'コピーに失敗しました'
  }
}

// The GIS script loads async, so it may not be there yet when the
// gate first appears: retry for a few seconds, then tell the user
// it could not be loaded (an ad blocker is the usual cause).
const GOOGLE_SCRIPT_RETRY_LIMIT = 10
const GOOGLE_SCRIPT_RETRY_MS = 300
let googleScriptTimer = null

const initGoogleSignIn = (attempt = 0) => {
  if (!window.google?.accounts?.id) {
    if (attempt < GOOGLE_SCRIPT_RETRY_LIMIT) {
      googleScriptTimer = setTimeout(() => {
        googleScriptTimer = null
        initGoogleSignIn(attempt + 1)
      }, GOOGLE_SCRIPT_RETRY_MS)
    } else {
      gateError.value =
        'Googleログインスクリプトの読み込みに失敗しました。広告ブロック等を解除して再読み込みしてください。'
    }
    return
  }
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => admin.onCredential(response.credential),
  })
  window.google.accounts.id.renderButton(document.getElementById('signin'), {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
  })
}

onUnmounted(() => {
  if (googleScriptTimer !== null) {
    clearTimeout(googleScriptTimer)
    googleScriptTimer = null
  }
})

// The gate's button element is re-created every time the gate
// becomes visible (the boot check ends, a logout, an expired
// session), so render the button on each arrival at the gate.
watch(
  phase,
  (next) => {
    if (next === 'gate') {
      initGoogleSignIn()
    }
  },
  { flush: 'post' },
)

onMounted(async () => {
  applyCurrentTheme()
  if (await admin.initFromHash(window.location.hash)) {
    return
  }
  await admin.restoreSession()
})

const onLogout = () => {
  issuedShare.value = null
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect()
  }
  admin.logout()
}
</script>

<template>
  <div class="layout">
    <header class="header">
      <h1>持ち物管理</h1>
      <div class="header-actions">
        <div class="header-buttons">
          <button ref="themeButton" class="theme-toggle" type="button" @click="toggleTheme">
            ライト
          </button>
          <button
            v-if="phase === 'ready' && !isShareSession"
            class="theme-toggle"
            type="button"
            @click="onLogout"
          >
            ログアウト
          </button>
          <template v-else></template>
        </div>
      </div>
    </header>
    <main>
      <nav v-if="phase === 'ready'" class="main-tabs" aria-label="画面切り替え">
        <button
          type="button"
          class="main-tab"
          :class="{ active: tab === 'list' }"
          :aria-selected="tab === 'list'"
          @click="tab = 'list'"
        >
          一覧
        </button>
        <button
          type="button"
          class="main-tab"
          :class="{ active: tab === 'form' }"
          :aria-selected="tab === 'form'"
          @click="openCreate"
        >
          登録
        </button>
        <button
          v-if="!isShareSession"
          type="button"
          class="main-tab"
          :class="{ active: tab === 'share' }"
          :aria-selected="tab === 'share'"
          @click="tab = 'share'"
        >
          共有
        </button>
        <template v-else></template>
      </nav>
      <template v-else></template>
      <div id="status"></div>

      <section v-if="phase === 'boot'" class="table-wrap auth-gate" aria-busy="true">
        <div class="spinner" aria-hidden="true"></div>
        <p class="meta">読み込んでいます…</p>
      </section>
      <template v-else></template>

      <section v-if="phase === 'gate'" class="table-wrap auth-gate">
        <h2 class="section-title">Googleログインが必要です</h2>
        <p class="meta">許可されたアカウントでサインインしてください。</p>
        <div id="signin" class="google-login-button"></div>
        <p class="error">{{ gateError }}</p>
      </section>
      <template v-else></template>

      <section v-if="phase === 'share-expired'" class="table-wrap">
        <h2 class="section-title">リンクの有効期限が切れています</h2>
        <p class="meta">
          この一時アクセスリンクは無効か、期限切れです。発行者に新しいリンクを依頼してください。
        </p>
      </section>
      <template v-else></template>

      <section v-if="phase === 'ready' && tab === 'list'" class="table-wrap">
        <div class="section-head">
          <h2 class="section-title">{{ listTitle }}</h2>
          <button class="theme-toggle" type="button" @click="admin.reload()">再読み込み</button>
        </div>
        <p v-if="notice" class="meta">{{ notice }}</p>
        <template v-else></template>
        <p v-if="shareBanner" class="meta">{{ shareBanner }}</p>
        <template v-else></template>
        <p v-if="email" class="meta">{{ email }} でログイン中</p>
        <template v-else></template>
        <SheetTabs :sheets="listSheets" :current="currentSheet" @select="onListSheet" />
        <div class="builder-tabs" role="tablist" aria-label="表示フィルター">
          <button
            type="button"
            class="builder-tab"
            :class="{ active: !flagOnly }"
            role="tab"
            :aria-selected="!flagOnly"
            @click="flagOnly = false"
          >
            すべて
          </button>
          <button
            type="button"
            class="builder-tab"
            :class="{ active: flagOnly }"
            role="tab"
            :aria-selected="flagOnly"
            @click="flagOnly = true"
          >
            整理対象のみ
          </button>
        </div>
        <div v-if="loading" class="alarm-row">
          <span class="meta">読み込み中…</span>
        </div>
        <template v-else>
        <div v-if="currentSheet === 'all'">
          <ItemRow
            v-for="entry in visibleCombined"
            :key="`${entry.sheet}:${entry.row}`"
            :entry="entry"
            :sub="entry.kind === 'subscriptions'"
            sheet-badge
            :editable="entry.sheet !== 'room'"
            @toggle-flag="toggleFlag"
            @edit="openEdit"
            @remove="remove"
          />
        </div>
        <div v-else-if="sheetKind(currentSheet) !== 'subscriptions'">
          <ItemRow
            v-for="item in visibleItems"
            :key="item.row"
            :entry="item"
            :editable="sheetKind(currentSheet) !== 'room'"
            @toggle-flag="toggleFlag"
            @edit="openEdit"
            @remove="remove"
          />
        </div>
        <div v-else>
          <ItemRow
            v-for="sub in visibleSubscriptions"
            :key="sub.row"
            :entry="sub"
            sub
            @toggle-flag="toggleFlag"
            @edit="openEdit"
            @remove="remove"
          />
        </div>
        </template>
        <p class="meta">{{ listStatus }}</p>
      </section>
      <template v-else></template>

      <ItemForm
        v-if="phase === 'ready' && tab === 'form'"
        :form="form"
        :title="formTitle"
        :is-sub="isSubForm"
        :editing="editingRow !== null"
        :sheets="formSheets"
        :current-sheet="currentSheet"
        :genre-options="genreOptions"
        :form-status="formStatus"
        :saving="saving"
        @sheet="onFormSheet"
        @submit="submit"
        @cancel="cancelEdit"
        @remove="removeFromForm"
      />
      <template v-else></template>

      <section v-if="phase === 'ready' && tab === 'share' && !isShareSession" class="table-wrap">
        <h2 class="section-title">一時アクセスリンク</h2>
        <p class="meta">
          ログイン不要で1か月間このページを使えるURLを発行します。新しいURLを発行すると、前のURLは無効になります。この画面を閉じると発行したURLは再表示できません。
        </p>
        <p class="error">{{ shareError }}</p>
        <div v-if="!issuedShare">
          <p>
            <button class="theme-toggle" type="button" @click="issue">
              1か月間有効なURLを発行
            </button>
          </p>
        </div>
        <div v-else>
          <p>
            <strong>{{ shareRemaining }}</strong>
            <span class="meta">（{{ shareExpires }} まで有効）</span>
          </p>
          <p>
            <input class="share-url-input" type="text" readonly aria-label="一時アクセスURL" :value="shareUrl" />
            <button class="theme-toggle" type="button" @click="copyShareUrl">URLをコピー</button>
          </p>
          <p>
            <button class="theme-toggle" type="button" @click="issue">新しいURLを発行し直す</button>
            <button class="theme-toggle" type="button" @click="revoke">今すぐ無効化する</button>
          </p>
        </div>
      </section>
      <template v-else></template>
    </main>
  </div>
</template>
