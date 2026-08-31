// Browser shim for Node.js 'stream' module used by xlsx-js-style
// This prevents the "Module externalized for browser compatibility" warning
// ✅ PASS 5: Added explicit return types so the file passes noImplicitAny.
export class Readable {
  static from(): Readable { return new Readable(); }
  pipe(): this { return this; }
  on(): this { return this; }
  read(): null { return null; }
}
export class Writable {
  write(): boolean { return true; }
  end(): void {}
  on(): this { return this; }
}
export class Transform extends Readable {}
export default { Readable, Writable, Transform };
