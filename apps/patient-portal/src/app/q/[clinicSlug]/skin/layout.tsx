import { ReactNode } from 'react';

/**
 * Skin brand scope: overrides shadcn oklch tokens with the Dr Skin FACT
 * rose / champagne / pearl palette (see globals.css `[data-brand="skin"]`).
 * Hair routes are unaffected.
 */
export default function SkinLayout({ children }: { children: ReactNode }) {
  return (
    <div data-brand="skin" className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
