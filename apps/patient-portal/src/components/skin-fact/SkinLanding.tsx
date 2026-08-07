import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { landingFeatures, SkinHeader } from './SkinBrand';
import styles from './skin-fact.module.css';

export function SkinLanding({ clinicSlug }: { clinicSlug: string }) {
  return (
    <div className={styles.scope}>
      <SkinHeader clinicSlug={clinicSlug} />
      <main>
        <section className={styles.hero}>
          <div className={styles.container}>
            <div className={styles.heroCard}>
              <Image className={styles.heroImage} src="/skin-fact/skin-hero.png" alt="Woman with naturally luminous skin" fill priority sizes="(max-width: 900px) 100vw, 1180px" />
              <div className={styles.heroVeil} />
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>Skin intelligence + dermatologist review</p>
                <h1 className={styles.serif}>Personalized skin care that starts with understanding.</h1>
                <p>Tell us what your skin is experiencing. Skin FACT organizes your history, images, and concerns for focused clinical review—without sending your assessment through HairOS.</p>
                <div className={styles.heroActions}>
                  <Link className={styles.button} href={`/skin/${clinicSlug}/assessment`}>Start your skin assessment <ArrowRight size={16} /></Link>
                  <a className={styles.buttonGhost} href="#how-it-works">How it works</a>
                </div>
                <div className={styles.trust}>
                  <span className={styles.trustDots}><span /><span /><span /></span>
                  Built for private, doctor-led skin care
                </div>
              </div>
              <div className={styles.proof}><strong><CheckCircle2 size={14} /> Clinically separated</strong>Skin data stays inside Skin FACT.</div>
            </div>
            <div className={styles.featureGrid} id="how-it-works">
              {landingFeatures.map(({ icon: Icon, title, body }) => (
                <div className={styles.feature} key={title}>
                  <Icon className={styles.featureIcon} size={20} strokeWidth={1.6} />
                  <strong>{title}</strong><p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className={styles.quote} id="clinical-standard">“Great skin is not by chance. It begins with the right clinical context.”</section>
      </main>
    </div>
  );
}
