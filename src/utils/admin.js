import { SHEETS } from '../constants/app.js'
import {
  buildShareUrl,
  formatShareExpiry,
  formatShareRemaining,
  shareSecondsLeft,
} from '../share.js'

// A blank item form (create mode). Unit starts at 1, matching the
// sheet's convention for newly bought items.
export function emptyItem() {
  return {
    title: '',
    image: '',
    url: '',
    price: '',
    unit: 1,
    genre: '',
    comment: '',
  }
}

// The display label for a sheet key.
export function sheetLabel(key) {
  return SHEETS.find((sheet) => sheet.key === key)?.label ?? key
}

// "¥2,029" for a numeric price; "" for blank or non-numeric cells.
export function formatPrice(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return ''
  }
  const digits = String(value).replace(/[^\d.-]/g, '')
  if (digits === '') {
    return ''
  }
  const n = Number(digits)
  if (!Number.isFinite(n)) {
    return ''
  }
  return `¥${Math.round(n).toLocaleString('en-US')}`
}

// The meta line under an item title: price (with unit when > 1),
// genre and comment, joined the way the sheet reads. A missing
// entry (a deformed payload row) reads as a blank line.
export function itemMeta(item) {
  const entry = item ?? {}
  const parts = []
  const price = formatPrice(entry.price)
  if (price) {
    const unit = Number(entry.unit)
    parts.push(Number.isFinite(unit) && unit > 1 ? `${price} ×${unit}` : price)
  }
  if (entry.genre) {
    parts.push(String(entry.genre))
  }
  if (entry.comment) {
    parts.push(String(entry.comment))
  }
  return parts.join(' / ')
}

// Copy a listed item into the edit form (price/unit become plain
// input values; blank stays blank). A missing entry opens the
// blank form.
export function formFromItem(item) {
  const entry = item ?? {}
  return {
    title: entry.title ?? '',
    image: entry.image ?? '',
    url: entry.url ?? '',
    price: entry.price ?? '',
    unit: entry.unit ?? '',
    genre: entry.genre ?? '',
    comment: entry.comment ?? '',
  }
}

// The issued-share display values (URL, remaining time, expiry
// label); all blank before a link is issued.
export function shareLinkView(issued, baseUrl, nowMs) {
  if (!issued) {
    return { url: '', remaining: '', expires: '' }
  }
  return {
    url: buildShareUrl(baseUrl, issued.share_token),
    remaining: formatShareRemaining(shareSecondsLeft(issued.expires_at, nowMs)),
    expires: formatShareExpiry(issued.expires_at),
  }
}

// An entry carries the tidy-up flag when its flag cell is filled
// (the sheet stores the text 整理対象 there).
export function isFlagged(entry) {
  return Boolean(entry && entry.flag)
}

// The list filter behind the 整理対象のみ toggle: pass-through
// unless the filter is on. A non-list (a deformed payload) reads
// as an empty list.
export function filterFlagged(entries, flaggedOnly) {
  if (!Array.isArray(entries)) {
    return []
  }
  return flaggedOnly ? entries.filter((entry) => isFlagged(entry)) : entries
}

// A blank subscription form (create mode). The basis defaults to the
// yearly side, the sheet's most common shape.
export function emptySubscription() {
  return {
    service: '',
    purpose: '',
    basis: 'yearly',
    amount: '',
    url: '',
  }
}

// Copy a listed subscription into the edit form: the amount input
// shows the entered side (the basis side); the other side is derived
// by the sheet's formulas. A missing entry opens the blank form.
export function formFromSubscription(sub) {
  const entry = sub ?? {}
  const basis = entry.basis === 'monthly' ? 'monthly' : 'yearly'
  return {
    service: entry.service ?? '',
    purpose: entry.purpose ?? '',
    basis,
    amount: basis === 'monthly' ? (entry.monthly ?? '') : (entry.yearly ?? ''),
    url: entry.url ?? '',
  }
}

// The cost line under a subscription name: yearly and monthly amounts
// (computed by the sheet) and the share of the monthly total when
// the sheet carries a ratio. A missing entry reads as a blank line.
export function subscriptionCost(sub) {
  const entry = sub ?? {}
  const parts = []
  const yearly = formatPrice(entry.yearly)
  const monthly = formatPrice(entry.monthly)
  if (yearly) {
    parts.push(`年 ${yearly}`)
  }
  if (monthly) {
    parts.push(`月 ${monthly}`)
  }
  const ratio = Number(entry.ratio)
  if (Number.isFinite(ratio) && ratio > 0) {
    parts.push(`${(ratio * 100).toFixed(1)}%`)
  }
  return parts.join(' / ')
}
