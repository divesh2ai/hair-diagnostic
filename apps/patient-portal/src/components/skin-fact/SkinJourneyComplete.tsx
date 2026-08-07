'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, ShieldCheck } from 'lucide-react';
import { loadSkinCommonProfile, loadSkinFactIntake, type SkinConcern, type SkinFactIntake } from '@/lib/skin-fact/skinJourney';
import styles from './pigmentation.module.css';
const LABELS:Record<SkinConcern,string>={ACNE:'Acne',PIGMENTATION:'Pigmentation',ANTI_AGEING:'Anti-Ageing'};
export function SkinJourneyComplete(){
 const clinicSlug=String(useParams().clinicSlug??'');const router=useRouter();const [intake,setIntake]=useState<SkinFactIntake|null>(null);
 useEffect(()=>{const profile=loadSkinCommonProfile(localStorage,clinicSlug);const current=profile?loadSkinFactIntake(localStorage,clinicSlug,profile.sessionId):null;if(!current){router.replace(`/q/${clinicSlug}/skin/intake?next=concerns`);return}setIntake(current)},[clinicSlug,router]);
 if(!intake)return null;const plural=intake.selectedConcerns.length>1;const isPigmentation=intake.selectedConcerns[0]==='PIGMENTATION';
 return <main className={styles.page}><section className={styles.processingCard}>{isPigmentation&&<div className={styles.processingBubbles} aria-hidden="true"><i/><i/><i/><i/></div>}<p className={styles.eyebrow}>DR SKIN FACT</p><h1>Your Skin FACT {plural?'assessments have':'assessment has'} been submitted</h1><p>Your answers and uploaded images have been securely shared with the clinical team for review.</p><div className={styles.statusList}>{intake.selectedConcerns.map((concern)=><span key={concern}>{intake.completedConcerns.includes(concern)?<Check size={17}/>:<ShieldCheck size={17}/>} {LABELS[concern]} {intake.completedConcerns.includes(concern)?'submitted':'awaiting completion'}</span>)}</div><button className={styles.secondary} onClick={()=>router.push(`/skin/${clinicSlug}`)}>Return to Skin FACT</button></section></main>;
}
