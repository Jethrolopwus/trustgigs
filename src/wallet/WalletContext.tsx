import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface WalletContextValue {
  address: string | null
  isConnected: boolean
  connect: () => void
  disconnect: () => void
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      isConnected: Boolean(address),
      connect: () => {
        // For now we just flag the UI as "connected". Actual on-chain
        // transactions still use the Stacks Wallet via openContractCall.
        if (!address) {
          setAddress('CONNECTED')
        }
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

