'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { loadSkinCommonProfile, loadSkinFactIntake, type SkinFactIntake } from '@/lib/skin-fact/skinJourney';
import styles from './pigmentation.module.css';
export function AntiAgeingUnavailable(){
 const clinicSlug=String(useParams().clinicSlug??'');const router=useRouter();const[intake,setIntake]=useState<SkinFactIntake|null>(null);
 useEffect(()=>{const profile=loadSkinCommonProfile(localStorage,clinicSlug);if(!profile){router.replace(`/q/${clinicSlug}/skin/intake?next=concerns`);return}const journey=loadSkinFactIntake(localStorage,clinicSlug,profile.sessionId);if(!journey?.selectedConcerns.includes('ANTI_AGEING')){router.replace(`/q/${clinicSlug}/skin/concerns`);return}setIntake(journey)},[clinicSlug,router]);
 if(!intake)return null;
 return <main className={`${styles.page} ${styles.transitionPage}`}><section className={styles.transitionCard} data-next-concern="ANTI_AGEING"><p className={styles.eyebrow}>{intake.selectedConcerns.length>1?`Concern ${intake.currentConcernIndex+1} of ${intake.selectedConcerns.length} · `:''}ANTI-AGEING</p><h1>Anti-Ageing clinical protocol unavailable</h1><p><ShieldCheck size={16}/> This selected concern has been preserved in your Skin FACT journey. No Acne, Pigmentation, or HairOS questions will be substituted.</p><button className={styles.secondary} onClick={()=>router.push(`/q/${clinicSlug}/skin/concerns`)}>Return to concern selection</button></section></main>;
}
