/**
 * AppShell Component
 * 
 * Persistent shell that never remounts during auth transitions.
 * Keeps the layout stable and prevents flashing/blinking.
 */

import { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }): JSX.Element | null {
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Main content area - children will change but shell stays mounted */}
      <main className="relative">{children}</main>
    </div>
  );
}
