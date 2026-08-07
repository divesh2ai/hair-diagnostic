import Link from 'next/link';
import { Activity, ArrowRight, LayoutDashboard, MessageCircle, ShieldCheck, Sparkles, Stethoscope, UserRound } from 'lucide-react';
import styles from './skin-fact.module.css';

export function SkinLogo({ href = '/skin/drfact-mumbai' }: { href?: string }) {
  return (
    <Link className={styles.brand} href={href} aria-label="Dr Skin FACT home">
      <span className={styles.brandMark}><Sparkles size={16} strokeWidth={1.7} /></span>
      <span className={styles.brandText}>DR SKIN FACT</span>
    </Link>
  );
}

export function SkinHeader({ clinicSlug, compact = false }: { clinicSlug: string; compact?: boolean }) {
  return (
    <header className={styles.header}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <SkinLogo href={`/skin/${clinicSlug}`} />
        {!compact && <nav className={styles.nav} aria-label="Skin FACT navigation">
          <a href="#how-it-works">How it works</a>
          <Link href={`/q/${clinicSlug}/skin/intake?next=concerns`}>Skin concerns</Link>
          <a href="#clinical-standard">Clinical standard</a>
          <Link className={styles.button} href={`/q/${clinicSlug}/skin/intake?next=concerns`}>
            Start assessment <ArrowRight size={15} />
          </Link>
        </nav>}
      </div>
    </header>
  );
}

export const landingFeatures = [
  { icon: Activity, title: 'Skin-specific assessment', body: 'Concern-led questions designed for dermatology review.' },
  { icon: Stethoscope, title: 'Doctor reviewed', body: 'Your submission routes only to the Skin FACT clinical queue.' },
  { icon: ShieldCheck, title: 'Private by design', body: 'Images are saved securely with scoped storage references.' },
  { icon: Sparkles, title: 'Personal to your skin', body: 'A calm, structured record of your concern and history.' },
];

export const dashboardNav = [
  { icon: LayoutDashboard, label: 'Overview' },
  { icon: Activity, label: 'Assessments' },
  { icon: Stethoscope, label: 'My plan' },
  { icon: MessageCircle, label: 'Messages' },
  { icon: UserRound, label: 'Profile' },
];
