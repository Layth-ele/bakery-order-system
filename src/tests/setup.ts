/**
 * Test Setup File
 */

import { vi, afterEach } from 'vitest';

// ─── Firebase mocks ───────────────────────────────────────────────────────────

vi.mock('@/firebase/config', () => ({
  // PASS 10 FIX: services/firebase/cloudFunctions.ts imports `app` from this
  // module and calls getFunctions(app) at module load time. The mock previously
  // omitted `app`, which made every test that transitively loaded cloudFunctions
  // fail with "No 'app' export is defined". Stub it as an empty object — the
  // firebase/functions mock above ignores the value anyway.
  app: {}, db: {}, auth: {}, storage: {}, analytics: null,
  isFirebaseConfigured: true,
  getFirebaseConfig: () => ({}),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), setDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  collection: vi.fn((_db: any, p: string) => ({ _path: p })),
  query: vi.fn((...a: any[]) => a), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'mock-id' }),
  onSnapshot: vi.fn(() => vi.fn()),
  serverTimestamp: vi.fn(() => new Date().toISOString()),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date(), seconds: Math.floor(Date.now()/1000), nanoseconds: 0 })),
    fromDate: vi.fn((d: Date) => ({ toDate: () => d, seconds: Math.floor(d.getTime()/1000), nanoseconds: 0 })),
  },
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})), signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(), onAuthStateChanged: vi.fn(() => vi.fn()),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})), ref: vi.fn(),
  uploadBytes: vi.fn(), getDownloadURL: vi.fn(),
}));

// PASS 10 FIX: services/firebase/cloudFunctions.ts calls `getFunctions(app)`
// at module load time. Several smoke tests transitively import it (via
// ordersService → orderWorkflowService → ...). Without this mock the import
// chain throws on a stub `app` and the whole test file fails to load.
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: {} })),
  connectFunctionsEmulator: vi.fn(),
}));

// PASS 10: The previous "require() bridge" for cutoffPolicy tests has been
// removed. The test file now imports the mocked module via `import * as ...`
// and accesses mocks through `vi.mocked(...)`, which is the idiomatic Vitest
// pattern and works in both jsdom and node environments without ad-hoc
// Module._load patching.

// ─── Browser globals ──────────────────────────────────────────────────────────

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

global.console = { ...console, error: vi.fn(), warn: vi.fn() };

afterEach(() => { vi.clearAllMocks(); });
