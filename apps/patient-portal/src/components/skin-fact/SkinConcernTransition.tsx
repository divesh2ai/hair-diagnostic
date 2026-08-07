'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import { concernRoute, loadSkinCommonProfile, loadSkinFactIntake, nextIncompleteConcern, type SkinConcern, type SkinFactIntake } from '@/lib/skin-fact/skinJourney';
import styles from './pigmentation.module.css';
const LABELS: Record<SkinConcern,string>={ACNE:'Acne',PIGMENTATION:'Pigmentation',ANTI_AGEING:'Anti-Ageing'};
export function SkinConcernTransition(){
 const clinicSlug=String(useParams().clinicSlug??'');const query=useSearchParams();const router=useRouter();
 const [intake,setIntake]=useState<SkinFactIntake|null>(null);const from=query.get('from') as SkinConcern|null;const requestedNext=query.get('next') as SkinConcern|null;
 useEffect(()=>{const profile=loadSkinCommonProfile(localStorage,clinicSlug);if(!profile){router.replace(`/q/${clinicSlug}/skin/intake?next=concerns`);return}const current=loadSkinFactIntake(localStorage,clinicSlug,profile.sessionId);const next=current?nextIncompleteConcern(current):null;if(!current||!next){router.replace(`/q/${clinicSlug}/skin/complete`);return}if(requestedNext!==next){router.replace(`/q/${clinicSlug}/skin/transition?from=${from??''}&next=${next}`);return}setIntake(current)},[clinicSlug,from,requestedNext,router]);
 if(!intake||!from||!requestedNext)return null;
 return <main className={`${styles.page} ${styles.transitionPage}`}><section className={styles.transitionCard} data-next-concern={requestedNext}><span className={styles.iconSeal}><Check size={23}/></span><p className={styles.eyebrow}>Concern {intake.currentConcernIndex+1} of {intake.selectedConcerns.length}</p><h1>{LABELS[from]} assessment complete</h1><p>Next, we’ll ask about your {LABELS[requestedNext].toLowerCase()} concern.</p><button className={styles.primary} onClick={()=>router.push(concernRoute(clinicSlug,requestedNext))}>Continue to {LABELS[requestedNext]} <ArrowRight size={16}/></button></section></main>;
}
