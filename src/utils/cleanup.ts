// ✅ FIREBASE MODE - no localStorage cleanup needed
export async function runCleanup(): Promise<{ cleaned: number }> {
  return { cleaned: 0 };
}
