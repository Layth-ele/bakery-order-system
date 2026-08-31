// ✅ FIREBASE MODE - useLocalStorage hook removed
// Use Firebase queries directly instead
import { useState } from 'react';
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(initialValue);
  return [state, setState];
}
