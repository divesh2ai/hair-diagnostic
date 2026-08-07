import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import styles from './skin-fact.module.css';

export function SkinBoardLanding({ clinicSlug }: { clinicSlug: string }) {
  return (
    <div className={`${styles.skinFactLandingTheme} ${styles.boardPage}`}>
      <main className={styles.boardFrame}>
        <Image
          className={styles.boardImage}
          src="/skin-fact/dr-skin-fact-landing.png"
          alt="Dr Skin FACT landing page: understand your skin, heal it from within, glow that lasts."
          width={1448}
          height={1086}
          preload
          unoptimized
          sizes="100vw"
        />
        <nav className={styles.boardHotspots} aria-label="Dr Skin FACT landing navigation">
          <a className={styles.hotHow} href="#how-it-works"><span className={styles.srOnly}>How it works</span></a>
          <Link className={styles.hotConcerns} href={`/q/${clinicSlug}/skin/intake?next=concerns`}><span className={styles.srOnly}>Skin concerns</span></Link>
          <a className={styles.hotAbout} href="#about"><span className={styles.srOnly}>About us</span></a>
          <a className={styles.hotClinics} href="#clinics"><span className={styles.srOnly}>For clinics</span></a>
          <Link className={styles.hotGetStarted} href={`/q/${clinicSlug}/skin/intake?next=concerns`}><span className={styles.srOnly}>Get started</span></Link>
          <Link className={styles.hotAssessment} href={`/q/${clinicSlug}/skin/intake?next=concerns`}><span>Start Your Skin Assessment</span><ArrowRight size={16} /></Link>
        </nav>
      </main>
      <section className={styles.mobileLandingCopy} aria-label="Start Dr Skin FACT">
        <p className={styles.eyebrow}>AI + dermatologist expertise</p>
        <h1 className={styles.serif}>Understand your skin. Heal it from within. <em>Glow that lasts.</em></h1>
        <p>Advanced analysis organizes your unique skin history for focused dermatologist review and a concern-specific plan.</p>
        <Link className={`${styles.button} ${styles.landingMobileCta}`} href={`/q/${clinicSlug}/skin/intake?next=concerns`}>
          Start assessment <ArrowRight size={16} />
        </Link>
        <span><ShieldCheck size={16} /> Skin FACT data stays separate from HairOS.</span>
      </section>
      <div className={styles.srOnly}>
        <h2 id="how-it-works">How Skin FACT works</h2>
        <p>Skin-specific assessment, dermatologist review, personalized treatment planning, and private delivery.</p>
        <h2 id="about">About Dr Skin FACT</h2>
        <p>A separate clinical skin product within the Dr. FACT platform.</p>
        <h2 id="clinics">For clinics</h2>
        <p>Skin assessments route to a dedicated Skin FACT clinical queue.</p>
      </div>
    </div>
  );
}
