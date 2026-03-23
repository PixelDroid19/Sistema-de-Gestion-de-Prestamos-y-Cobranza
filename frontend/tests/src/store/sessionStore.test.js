import { beforeEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '@/store/sessionStore'

describe('sessionStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useSessionStore.setState({ user: null, token: null, isReady: true })
  })

  it('normalizes legacy agent sessions to admin during bootstrap', () => {
    localStorage.setItem('session', JSON.stringify({
      token: 'legacy-token',
      userData: { id: 4, name: 'Miles Agent', role: 'agent' },
      loginTime: Date.now(),
      lastActivity: Date.now(),
    }))

    useSessionStore.getState().bootstrapSession()

    expect(useSessionStore.getState().user).toEqual({ id: 4, name: 'Miles Agent', role: 'admin' })
    expect(useSessionStore.getState().token).toBe('legacy-token')
    expect(JSON.parse(localStorage.getItem('user'))).toEqual({ id: 4, name: 'Miles Agent', role: 'admin' })
  })
})
