import { describe, expect, it } from 'vitest'
import {
  filterFlagged,
  formFromItem,
  formFromSubscription,
  formatPrice,
  itemMeta,
  shareLinkView,
  subscriptionCost,
} from '../../src/utils/admin.js'

// Abnormal cases for the shaping layer. The everything-i-own-gas /exec
// payload is trusted to be item/subscription-shaped, but a deformed
// row (a missing entry, a number where text is expected, amounts
// arriving as strings) must degrade to blanks instead of throwing
// on the way to the screen.
describe('admin utils with deformed entries', () => {
  it('itemMeta of a missing entry is blank', () => {
    expect(itemMeta(null)).toBe('')
    expect(itemMeta(undefined)).toBe('')
  })

  it('itemMeta tolerates null fields and string numerics', () => {
    expect(itemMeta({ price: null, unit: null, genre: null, comment: null })).toBe('')
    expect(itemMeta({ price: '2,400', unit: '3', genre: 'G', comment: '' })).toBe('¥2,400 ×3 / G')
    expect(itemMeta({ price: 1500, unit: '2', genre: 42, comment: true })).toBe(
      '¥1,500 ×2 / 42 / true',
    )
    expect(itemMeta({ price: {}, unit: {}, genre: '', comment: '' })).toBe('')
  })

  it('formFromItem of a missing entry is the blank form', () => {
    const blank = { title: '', image: '', url: '', price: '', unit: '', genre: '', comment: '' }
    expect(formFromItem(null)).toEqual(blank)
    expect(formFromItem(undefined)).toEqual(blank)
  })

  it('formFromSubscription of a missing entry is the blank yearly form', () => {
    const blank = { service: '', purpose: '', basis: 'yearly', amount: '', url: '' }
    expect(formFromSubscription(null)).toEqual(blank)
    expect(formFromSubscription(undefined)).toEqual(blank)
  })

  it('subscriptionCost of a missing entry is blank', () => {
    expect(subscriptionCost(null)).toBe('')
    expect(subscriptionCost(undefined)).toBe('')
  })

  it('subscriptionCost tolerates amounts and ratio arriving as strings', () => {
    expect(subscriptionCost({ yearly: '21765', monthly: '1813', ratio: '0.015' })).toBe(
      '年 ¥21,765 / 月 ¥1,813 / 1.5%',
    )
    expect(subscriptionCost({ yearly: {}, monthly: [], ratio: 'abc' })).toBe('')
  })

  it('filterFlagged treats a non-list as an empty list', () => {
    expect(filterFlagged(null, true)).toEqual([])
    expect(filterFlagged(undefined, true)).toEqual([])
    expect(filterFlagged('oops', true)).toEqual([])
    expect(filterFlagged({}, false)).toEqual([])
  })

  it('formatPrice hides non-numeric objects and specials', () => {
    expect(formatPrice({})).toBe('')
    expect(formatPrice([])).toBe('')
    expect(formatPrice(NaN)).toBe('')
    expect(formatPrice(Infinity)).toBe('')
    expect(formatPrice('1,234円')).toBe('¥1,234')
  })

  it('shareLinkView tolerates an unparseable expiry', () => {
    const view = shareLinkView(
      { share_token: 'tok', expires_at: 'not-a-date' },
      'https://example.com/app/',
      0,
    )
    expect(view.url).toBe('https://example.com/app/#share=tok')
    expect(view.remaining).toBe('')
    expect(view.expires).toBe('')
  })
})
