import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface WalletContextValue {
  address: string | null
  isConnected: boolean
  connect: () => void
  disconnect: () => void
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)

const DEFAULT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) ?? null

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      isConnected: Boolean(address),
      connect: () => {
        // Fallback: simulate a connected address using the configured
        // contract address. Real signing happens when transactions are
        // sent via `openContractCall`, which triggers the wallet popup.
        if (!address) {
          setAddress(DEFAULT_ADDRESS ?? 'CONNECTED')
        }
      },
      disconnect: () => {
        setAddress(null)
      },
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

