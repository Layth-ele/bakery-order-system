// ✅ FIREBASE MODE - localStorage utilities removed
// Kept as stub for import compatibility

export function safeParseJSON<T>(key: string, defaultValue: T): T {
  return defaultValue; // always return default in Firebase mode
}

export function safeSetJSON(_key: string, _value: any): void {
  // no-op in Firebase mode
}

export function safeRemoveItem(_key: string): void {
  // no-op in Firebase mode
}
