import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dr Skin FACT — Clinical skin intelligence',
  description: 'A dedicated doctor-led skin assessment experience.',
};

export default function SkinFactLayout({ children }: { children: ReactNode }) {
  return children;
}
