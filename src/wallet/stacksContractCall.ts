import type { ContractCallOptions } from '@stacks/transactions'
import { openContractCall } from '@stacks/connect'

const appDetails = {
  name: 'TrustGigs',
  icon: '/vite.svg',
}

export async function callContractWithWallet(options: Omit<ContractCallOptions, 'appDetails'>) {
  return new Promise<void>((resolve, reject) => {
    void openContractCall({
      ...options,
      appDetails,
      onFinish: () => resolve(),
      onCancel: () => reject(new Error('User cancelled contract call')),
    })
  })
}

