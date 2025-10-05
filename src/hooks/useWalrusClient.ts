import { WalrusClientContext } from '@/providers/WalrusClientContext';
import { useContext } from 'react';

export function useWalrusClient() {
  const walrusClient = useContext(WalrusClientContext);
  return walrusClient;
}
