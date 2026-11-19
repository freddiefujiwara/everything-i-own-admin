import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAdmin } from '../../src/composables/useAdmin.js'

const ITEM = { row: 2, title: 'A', image: '', url: '', price: 100, unit: 1, genre: 'G', comment: '' }
const SUB = {
  row: 2,
  service: 'NHK',
  purpose: 'tv',
  basis: 'yearly',
  yearly: 21765,
  monthly: 1813,
  ratio: 0.01,
  url: '',
}

const routeFetch = (handler) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body)
      return { json: async () => handler(body) }
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

// Abnormal cases at the /exec boundary: the response claims ok but
// its lists are missing, null, the wrong shape, or carry entries
// that are not objects. The page must land on a sane empty state
// (or keep the healthy sheets) instead of breaking the list.
describe('useAdmin with deformed list payloads', () => {
  it('treats a null items payload as an empty list', async () => {
    routeFetch((body) => {
      if (body.action === 'list_genres') return { ok: true, genres: ['G'] }
      if (body.action === 'list_items') return { ok: true, sheet: body.sheet, items: null }
      return { ok: true }
    })
    const admin = useAdmin()
    expect(await admin.initFromHash('#share=tok')).toBe(true)
    expect(admin.items.value).toEqual([])
    expect(admin.listStatus.value).toBe('0件')
  })

  it('treats a missing items field as an empty list', async () => {
    routeFetch((body) => {
      if (body.action === 'list_genres') return { ok: true, genres: ['G'] }
      if (body.action === 'list_items') return { ok: true, sheet: body.sheet }
      return { ok: true }
    })
    const admin = useAdmin()
    expect(await admin.initFromHash('#share=tok')).toBe(true)
    expect(admin.items.value).toEqual([])
    expect(admin.listStatus.value).toBe('0件')
  })

  it('treats a non-array items payload as an empty list', async () => {
    for (const items of ['oops', { row: 2 }]) {
      routeFetch((body) => {
        if (body.action === 'list_genres') return { ok: true, genres: ['G'] }
        if (body.action === 'list_items') return { ok: true, sheet: body.sheet, items }
        return { ok: true }
      })
      const admin = useAdmin()
      expect(await admin.initFromHash('#share=tok')).toBe(true)
      expect(admin.items.value).toEqual([])
      expect(admin.listStatus.value).toBe('0件')
      vi.unstubAllGlobals()
    }
  })

  it('drops null and non-object entries from the items list', async () => {
    routeFetch((body) => {
      if (body.action === 'list_genres') return { ok: true, genres: ['G'] }
      if (body.action === 'list_items')
        return { ok: true, sheet: body.sheet, items: [null, ITEM, 'oops', undefined] }
      return { ok: true }
    })
    const admin = useAdmin()
    expect(await admin.initFromHash('#share=tok')).toBe(true)
    expect(admin.items.value).toEqual([ITEM])
    expect(admin.listStatus.value).toBe('1件')
  })

  it('treats a deformed subscriptions payload as an empty list', async () => {
    routeFetch((body) => {
      if (body.action === 'list_genres') return { ok: true, genres: ['G'] }
      if (body.action === 'list_items' && body.sheet === 'subscriptions')
        return { ok: true, sheet: 'subscriptions', subscriptions: null }
      if (body.action === 'list_items') return { ok: true, sheet: body.sheet, items: [ITEM] }
      return { ok: true }
    })
    const admin = useAdmin()
    expect(await admin.initFromHash('#share=tok')).toBe(true)
    await admin.selectSheet('subscriptions')
    expect(admin.subscriptions.value).toEqual([])
    expect(admin.listStatus.value).toBe('0件')
  })

  it('keeps the combined view alive when one sheet payload is deformed', async () => {
    routeFetch((body) => {
      if (body.action === 'list_genres') return { ok: true, genres: ['G'] }
      if (body.action === 'list_items' && body.sheet === 'variety')
        return { ok: true, sheet: 'variety', items: null }
      if (body.action === 'list_items' && body.sheet === 'subscriptions')
        return { ok: true, sheet: 'subscriptions', subscriptions: [SUB] }
      if (body.action === 'list_items') return { ok: true, sheet: body.sheet, items: [ITEM] }
      return { ok: true }
    })
    const admin = useAdmin()
    expect(await admin.initFromHash('#share=tok')).toBe(true)
    await admin.selectSheet('all')
    expect(admin.combined.value).toHaveLength(4)
    expect(admin.combined.value.map((entry) => entry.sheet)).toEqual([
      'workman',
      'others',
      'room',
      'subscriptions',
    ])
    expect(admin.listStatus.value).toBe('4件')
  })

  it('drops null entries from the combined view instead of ghost rows', async () => {
    routeFetch((body) => {
      if (body.action === 'list_genres') return { ok: true, genres: ['G'] }
      if (body.action === 'list_items' && body.sheet === 'subscriptions')
        return { ok: true, sheet: 'subscriptions', subscriptions: [SUB] }
      if (body.action === 'list_items')
        return { ok: true, sheet: body.sheet, items: [null, ITEM] }
      return { ok: true }
    })
    const admin = useAdmin()
    expect(await admin.initFromHash('#share=tok')).toBe(true)
    await admin.selectSheet('all')
    expect(admin.combined.value).toHaveLength(5)
    expect(
      admin.combined.value.every((entry) => entry && typeof entry === 'object'),
    ).toBe(true)
    expect(admin.listStatus.value).toBe('5件')
  })

  it('treats a deformed genres payload as no genres', async () => {
    routeFetch((body) => {
      if (body.action === 'list_genres') return { ok: true, genres: '音楽' }
      if (body.action === 'list_items') return { ok: true, sheet: body.sheet, items: [ITEM] }
      return { ok: true }
    })
    const admin = useAdmin()
    expect(await admin.initFromHash('#share=tok')).toBe(true)
    expect(admin.genres.value).toEqual([])
  })

  it('keeps only string genres from a mixed payload', async () => {
    routeFetch((body) => {
      if (body.action === 'list_genres') return { ok: true, genres: ['音楽', 42, null] }
      if (body.action === 'list_items') return { ok: true, sheet: body.sheet, items: [ITEM] }
      return { ok: true }
    })
    const admin = useAdmin()
    expect(await admin.initFromHash('#share=tok')).toBe(true)
    expect(admin.genres.value).toEqual(['音楽'])
  })

  it('survives a null response body as a plain load failure', async () => {
    routeFetch(() => null)
    const admin = useAdmin()
    expect(await admin.initFromHash('#share=tok')).toBe(true)
    expect(admin.phase.value).toBe('ready')
    expect(admin.items.value).toEqual([])
    expect(admin.listStatus.value).toBe('読み込みに失敗しました')
  })
})
