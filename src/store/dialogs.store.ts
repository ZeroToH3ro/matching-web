import { create } from 'zustand'

interface DialogsState {
  connectWalletOpen: boolean
  walletLoginOpen: boolean
  setConnectWalletOpen: (open: boolean) => void
  setWalletLoginOpen: (open: boolean) => void
  closeAll: () => void
}

export const useDialogsStore = create<DialogsState>((set) => ({
  connectWalletOpen: false,
  walletLoginOpen: false,
  setConnectWalletOpen: (open) => set({ connectWalletOpen: open }),
  setWalletLoginOpen: (open) => set({ walletLoginOpen: open }),
  closeAll: () => set({ connectWalletOpen: false, walletLoginOpen: false }),
}))
