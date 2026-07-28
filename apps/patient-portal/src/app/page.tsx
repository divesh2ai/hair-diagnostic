import { redirect } from 'next/navigation';

const DEFAULT_CLINIC = '/q/drfact-mumbai';

export default function RootPage() {
  redirect(DEFAULT_CLINIC);
}
