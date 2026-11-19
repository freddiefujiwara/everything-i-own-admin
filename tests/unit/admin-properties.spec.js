import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  filterFlagged,
  formFromItem,
  formFromSubscription,
  formatPrice,
  isFlagged,
  itemMeta,
  subscriptionCost,
} from '../../src/utils/admin.js'
import {
  buildShareUrl,
  formatShareExpiry,
  formatShareRemaining,
  parseShareToken,
  shareSecondsLeft,
} from '../../src/share.js'

// Property-based tests for the pure transforms: whatever the sheet
// (or a deformed /exec payload) hands over, the display strings
// must stay well-formed and the mappings must conserve the data.
const NUM_RUNS = { numRuns: 100 }

describe('formatPrice properties', () => {
  it('always yields blank or a yen amount, never NaN/undefined text', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.double(),
          fc.string(),
          fc.constantFrom(null, undefined, true, {}, []),
        ),
        (value) => {
          const out = formatPrice(value)
          expect(out === '' || /^¥-?[\d,]+$/.test(out)).toBe(true)
        },
      ),
      NUM_RUNS,
    )
  })

  it('is idempotent for integer prices', () => {
    fc.assert(
      fc.property(fc.integer(), (value) => {
        expect(formatPrice(formatPrice(value))).toBe(formatPrice(value))
      }),
      NUM_RUNS,
    )
  })
})

describe('itemMeta properties', () => {
  const itemArb = fc.record({
    price: fc.oneof(fc.integer({ min: 0 }), fc.constant(''), fc.constant(null)),
    unit: fc.oneof(fc.integer({ min: 0, max: 99 }), fc.string()),
    genre: fc.string(),
    comment: fc.string(),
  })

  it('never throws and conserves price, genre and comment', () => {
    fc.assert(
      fc.property(itemArb, (item) => {
        const out = itemMeta(item)
        expect(typeof out).toBe('string')
        const price = formatPrice(item.price)
        if (price) {
          expect(out.includes(price)).toBe(true)
        }
        if (item.genre) {
          expect(out.includes(item.genre)).toBe(true)
        }
        if (item.comment) {
          expect(out.includes(item.comment)).toBe(true)
        }
      }),
      NUM_RUNS,
    )
  })
})

describe('filterFlagged properties', () => {
  const entriesArb = fc.array(
    fc.record({
      flag: fc.oneof(fc.constant('整理対象'), fc.constant(''), fc.constant(undefined)),
      title: fc.string(),
    }),
    { maxLength: 30 },
  )

  it('keeps exactly the flagged entries, in order', () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const out = filterFlagged(entries, true)
        expect(out).toEqual(entries.filter((entry) => isFlagged(entry)))
        expect(out.every((entry) => isFlagged(entry))).toBe(true)
      }),
      NUM_RUNS,
    )
  })

  it('is the identity when the filter is off', () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        expect(filterFlagged(entries, false)).toBe(entries)
      }),
      NUM_RUNS,
    )
  })
})

describe('form mapping properties', () => {
  const valueArb = fc.oneof(fc.string(), fc.integer(), fc.constant(null), fc.constant(undefined))

  it('formFromItem copies each field verbatim, blanking null/undefined', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: valueArb,
          image: valueArb,
          url: valueArb,
          price: valueArb,
          unit: valueArb,
          genre: valueArb,
          comment: valueArb,
        }),
        (item) => {
          const form = formFromItem(item)
          for (const key of ['title', 'image', 'url', 'price', 'unit', 'genre', 'comment']) {
            expect(form[key]).toEqual(item[key] ?? '')
          }
        },
      ),
      NUM_RUNS,
    )
  })

  it('formFromSubscription normalizes the basis and picks its amount side', () => {
    fc.assert(
      fc.property(
        fc.record({
          service: valueArb,
          purpose: valueArb,
          basis: fc.oneof(fc.constant('monthly'), fc.constant('yearly'), fc.string(), fc.constant(null)),
          monthly: valueArb,
          yearly: valueArb,
          url: valueArb,
        }),
        (sub) => {
          const form = formFromSubscription(sub)
          const basis = sub.basis === 'monthly' ? 'monthly' : 'yearly'
          expect(form.basis).toBe(basis)
          expect(form.amount).toEqual(basis === 'monthly' ? (sub.monthly ?? '') : (sub.yearly ?? ''))
        },
      ),
      NUM_RUNS,
    )
  })
})

describe('subscriptionCost properties', () => {
  const amountArb = fc.oneof(fc.integer({ min: 0 }), fc.constant(''), fc.constant(null))

  it('never leaks NaN/undefined and conserves the formatted amounts', () => {
    fc.assert(
      fc.property(
        fc.record({
          yearly: amountArb,
          monthly: amountArb,
          ratio: fc.oneof(fc.double(), fc.constant('')),
        }),
        (sub) => {
          const out = subscriptionCost(sub)
          expect(typeof out).toBe('string')
          expect(out.includes('NaN')).toBe(false)
          expect(out.includes('undefined')).toBe(false)
          const yearly = formatPrice(sub.yearly)
          if (yearly) {
            expect(out.includes(`年 ${yearly}`)).toBe(true)
          }
          const monthly = formatPrice(sub.monthly)
          if (monthly) {
            expect(out.includes(`月 ${monthly}`)).toBe(true)
          }
        },
      ),
      NUM_RUNS,
    )
  })
})

describe('share helper properties', () => {
  it('round-trips any token through buildShareUrl and parseShareToken', () => {
    // parseShareToken consumes a location hash ("#share=...") — that
    // is what App passes from window.location.hash — so the round
    // trip goes through the built URL's hash portion, not the full
    // URL. Tokens are also restricted to well-formed strings
    // (unit: 'grapheme'): a lone surrogate cannot occur in a real
    // location hash or a server-issued token, and encodeURIComponent
    // rejects it outright, so it is outside the caller's domain.
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (token) => {
        const url = buildShareUrl('https://example.com/app/', token)
        expect(parseShareToken(url.slice(url.indexOf('#')))).toBe(token)
      }),
      NUM_RUNS,
    )
  })

  it('shareSecondsLeft is null or a non-negative integer for any input', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (expiresAt, nowMs) => {
        const out = shareSecondsLeft(expiresAt, nowMs)
        expect(out === null || (Number.isInteger(out) && out >= 0)).toBe(true)
      }),
      NUM_RUNS,
    )
  })

  it('formatShareRemaining only yields its known label shapes', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), fc.integer({ min: -100, max: 10_000_000 })),
        (seconds) => {
          const out = formatShareRemaining(seconds)
          expect(out === '' || out === '期限切れ' || out.startsWith('残り約')).toBe(true)
        },
      ),
      NUM_RUNS,
    )
  })

  it('formatShareExpiry is blank or a YYYYMMDD HH:mm label for any input', () => {
    fc.assert(
      fc.property(fc.string(), (expiresAt) => {
        const out = formatShareExpiry(expiresAt)
        expect(out === '' || /^\d{8} \d{2}:\d{2}$/.test(out)).toBe(true)
      }),
      NUM_RUNS,
    )
  })
})
