import { Suspense } from 'react';
import { SkinFactCommonProfile } from '@/components/skin-fact/SkinFactCommonProfile';
export default function SkinIntakePage() { return <Suspense fallback={null}><SkinFactCommonProfile /></Suspense>; }
