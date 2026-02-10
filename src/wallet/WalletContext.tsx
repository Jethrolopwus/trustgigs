import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface WalletContextValue {
  address: string | null
  isConnected: boolean
  connect: () => void
  disconnect: () => void
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)

const DEMO_ADDRESSES = [
  'STEMPLOYER1',
  'STEMPLOYER2',
  'STAPPLICANT1',
  'STAPPLICANT2',
  'STAPPLICANT3',
] as const

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(DEMO_ADDRESSES[0])

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      isConnected: Boolean(address),
      connect: () => {
        // Simple rotation through demo addresses to simulate multiple users.
        setAddress((prev) => {
          const currentIndex = DEMO_ADDRESSES.findIndex((a) => a === prev)
          const nextIndex = (currentIndex + 1 + DEMO_ADDRESSES.length) % DEMO_ADDRESSES.length
          return DEMO_ADDRESSES[nextIndex]
        })
      },
      disconnect: () => setAddress(null),
    }),
    [address],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return ctx
}

