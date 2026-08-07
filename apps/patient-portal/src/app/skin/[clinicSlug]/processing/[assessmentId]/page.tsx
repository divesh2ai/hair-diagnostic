import Link from 'next/link';
import { Check, Clock3, ShieldCheck } from 'lucide-react';
import styles from '@/components/skin-fact/skin-fact.module.css';

export default async function SkinProcessingPage({ params }: { params: Promise<{ clinicSlug: string; assessmentId: string }> }) {
  const { clinicSlug, assessmentId } = await params;
  return <main className={`${styles.scope} ${styles.processing}`}>
    <section className={styles.processingCard}>
      <div className={styles.orbit}><span className={styles.orbitDot} /></div>
      <p className={styles.eyebrow}>Skin FACT clinical routing</p>
      <h1>Your skin assessment is safely submitted.</h1>
      <p>Your acne history and images are now in the dedicated Skin FACT review queue. They are not being processed by the HairOS clinical engine.</p>
      <div className={styles.processList}>
        <div className={styles.processItem}><span className={styles.processState}><Check size={15} /></span><span>Answers and storage references secured</span></div>
        <div className={styles.processItem}><span className={styles.processState}><ShieldCheck size={15} /></span><span>Routed to Skin FACT clinical review</span></div>
        <div className={styles.processItem}><span className={styles.processState}><Clock3 size={15} /></span><span>Dermatologist review pending</span></div>
      </div>
      <Link className={styles.button} href={`/skin/${clinicSlug}`}>Return to Skin FACT</Link>
      <p className={styles.muted}>Reference: {assessmentId}</p>
    </section>
  </main>;
}
