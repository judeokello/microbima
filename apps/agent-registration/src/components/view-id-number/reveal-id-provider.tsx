'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type RevealState = {
  key: string | null
  value: string | null
}

type RevealIdContextValue = {
  revealedKey: string | null
  revealedValue: string | null
  isRevealingKey: string | null
  reveal: (key: string, fetcher: () => Promise<string>, durationMs: number) => Promise<void>
  hide: () => void
}

const RevealIdContext = createContext<RevealIdContextValue | null>(null)

export function RevealIdProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RevealState>({ key: null, value: null })
  const [isRevealingKey, setIsRevealingKey] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setState({ key: null, value: null })
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const reveal = useCallback(
    async (key: string, fetcher: () => Promise<string>, durationMs: number) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setState({ key: null, value: null })
      setIsRevealingKey(key)
      try {
        const value = await fetcher()
        setState({ key, value })
        timerRef.current = setTimeout(() => {
          setState({ key: null, value: null })
          timerRef.current = null
        }, durationMs)
      } finally {
        setIsRevealingKey((current) => (current === key ? null : current))
      }
    },
    []
  )

  return (
    <RevealIdContext.Provider
      value={{
        revealedKey: state.key,
        revealedValue: state.value,
        isRevealingKey,
        reveal,
        hide,
      }}
    >
      {children}
    </RevealIdContext.Provider>
  )
}

export function useRevealId() {
  const ctx = useContext(RevealIdContext)
  if (!ctx) {
    throw new Error('useRevealId must be used within RevealIdProvider')
  }
  return ctx
}
