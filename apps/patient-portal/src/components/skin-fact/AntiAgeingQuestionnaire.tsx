'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, FileUp, ImagePlus, LoaderCircle, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import {
  ANTI_AGEING_PROTOCOL,
  antiAgeingStorageKey,
  buildAntiAgeingSubmission,
  containsInlineBinary,
  isValidAntiAgeingDraft,
  pruneHiddenAntiAgeingAnswers,
  requiredAntiAgeingImageViews,
  toggleExclusiveSelection,
  visibleAntiAgeingStepIds,
  type AntiAgeingAnswers,
  type AntiAgeingDraft,
  type AntiAgeingStorageReference,
  type AntiAgeingUploadView,
} from '@/lib/skin-fact/antiAgeing';
import {
  loadSkinCommonProfile,
  loadSkinFactIntake,
  markConcernComplete,
  skinIntakeStorageKey,
  type SkinCommonProfile,
  type SkinFactIntake,
} from '@/lib/skin-fact/skinJourney';
import styles from './anti-ageing.module.css';
import { VoiceTextField } from './VoiceTextField';

type Question = {
  id:string; type:string; title:string; instruction:string; required:boolean;
  options?:{label:string;value:string}[]; exclusiveValue?:string;
};
const QUESTIONS = ANTI_AGEING_PROTOCOL.questions as Question[];
const LABELS:Record<string,string> = {
  AA_01:'Visible changes',AA_01A:'Other change',AA_02:'Concern level',AA_03:'Sun exposure',
  AA_04:'Current products',AA_05:'Product names',AA_06:'Medical history',AA_06A:'Medical history details',
  AA_07:'Previous professional care',AA_08:'Previous treatments',AA_08A:'Other treatment',
  AA_09:'Previous documents',AA_10:'Clinical images',AA_11:'Educational interests',AA_12:'Educational videos',
};
const PHASES:Record<string,string> = {
  AA_01:'Your priorities',AA_01A:'Your priorities',AA_02:'Your priorities',AA_03:'Skin history',
  AA_04:'Current care',AA_05:'Current care',AA_06:'Health history',AA_06A:'Health history',
  AA_07:'Previous care',AA_08:'Previous care',AA_08A:'Previous care',AA_09:'Clinical documents',
  AA_10:'Clinical images',AA_11:'Learning preferences',AA_12:'Learning preferences',AA_13:'Review',
};
const VIEW_LABELS:Record<string,string>={FRONT:'Front view',LEFT:'Left-side view',RIGHT:'Right-side view'};

const previewCommon:SkinCommonProfile={productType:'SKIN_FACT',intakeType:'COMMON',version:'2.0.0',clinicSlug:'preview',sessionId:'preview-session',completedAt:new Date().toISOString(),answers:{name:'Ananya Sharma',age:'44',gender:'Female',skinType:'Combination',sensitiveSkin:'No'}};
const previewIntake:SkinFactIntake={productType:'SKIN_FACT',version:'1.0.0',clinicSlug:'preview',patientSessionId:'preview-session',intakeId:'preview-intake',selectedConcerns:['ANTI_AGEING'],currentConcernIndex:0,completedConcerns:[],assessmentIds:{},status:'IN_PROGRESS'};

export function AntiAgeingQuestionnaire({preview=false}:{preview?:boolean}) {
  const routeParams=useParams();
  const clinicSlug=preview?'preview':String(routeParams.clinicSlug??'');
  const router=useRouter();
  const [common,setCommon]=useState<SkinCommonProfile|null>(previewCommon && preview ? previewCommon : null);
  const [intake,setIntake]=useState<SkinFactIntake|null>(preview ? previewIntake : null);
  const [draft,setDraft]=useState<AntiAgeingDraft|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [ack,setAck]=useState(false);
  const [submitting,setSubmitting]=useState(false);

  useEffect(()=>{
    const profile=preview?previewCommon:loadSkinCommonProfile(localStorage,clinicSlug);
    if(!profile?.completedAt){router.replace(`/q/${clinicSlug}/skin/intake?next=concerns`);return}
    const journey=preview?previewIntake:loadSkinFactIntake(localStorage,clinicSlug,profile.sessionId);
    if(!journey?.selectedConcerns.includes('ANTI_AGEING')){router.replace(`/q/${clinicSlug}/skin/concerns`);return}
    let saved:unknown=null;
    try{saved=JSON.parse(localStorage.getItem(antiAgeingStorageKey(clinicSlug))??'null')}catch{}
    const current=isValidAntiAgeingDraft(saved,clinicSlug,profile.sessionId,journey.intakeId)?saved:null;
    setCommon(profile);setIntake(journey);
    setDraft(current??{productType:'SKIN_FACT',concernType:'ANTI_AGEING',protocolId:'skin-anti-ageing',protocolVersion:'1.0.0',clinicSlug,patientSessionId:profile.sessionId,commonIntakeId:profile.sessionId,skinIntakeId:journey.intakeId,selectedConcernCount:journey.selectedConcerns.length,stepId:'AA_01',answers:{}});
    setLoaded(true);
  },[clinicSlug,preview,router]);
  useEffect(()=>{if(loaded&&draft)localStorage.setItem(antiAgeingStorageKey(clinicSlug),JSON.stringify(draft))},[clinicSlug,draft,loaded]);

  const visible=useMemo(()=>visibleAntiAgeingStepIds(draft?.answers??{}),[draft?.answers]);
  const currentId=draft&&visible.includes(draft.stepId)?draft.stepId:visible[0];
  const index=Math.max(0,visible.indexOf(currentId));
  const question=QUESTIONS.find((item)=>item.id===currentId);
  if(!loaded||!draft||!common||!intake)return <main className={styles.processing}>Loading Anti‑Ageing assessment…</main>;

  const setAnswer=(id:string,value:AntiAgeingAnswers[string])=>{setError('');setDraft((valueDraft)=>valueDraft?{...valueDraft,answers:{...valueDraft.answers,[id]:value}}:valueDraft)};
  const go=(id:string)=>setDraft((value)=>value?{...value,stepId:id}:value);
  function select(q:Question,value:string){
    if(q.type==='multi_select'){
      const current=Array.isArray(draft!.answers[q.id])?draft!.answers[q.id] as string[]:[];
      setAnswer(q.id,toggleExclusiveSelection(current,value,q.exclusiveValue));return;
    }
    setAnswer(q.id,value);
  }
  function validate(){
    let message='';const value=draft!.answers[currentId];
    if(currentId==='AA_13'&&!ack)message='Please confirm the clinical-review acknowledgement before submitting.';
    else if(question?.required&&(value===undefined||value===''||(Array.isArray(value)&&value.length===0)))message='Please complete this question before continuing.';
    setError(message);return !message;
  }
  function next(){if(validate()&&index<visible.length-1)go(visible[index+1])}
  function back(){setError('');if(index>0)go(visible[index-1]);else router.push(preview?'/design-preview/skin-fact/anti-ageing':`/q/${clinicSlug}/skin/anti-ageing`)}
  async function submit(){
    if(!validate())return;setSubmitting(true);setError('');
    try{
      const clean={...draft!,answers:pruneHiddenAntiAgeingAnswers(draft!.answers)};
      const payload=buildAntiAgeingSubmission(common!,clean);
      if(containsInlineBinary(payload))throw new Error('Invalid inline upload data.');
      if(preview){router.push('/design-preview/skin-fact/anti-ageing/processing');return}
      const response=await fetch('/api/assessment/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clinicSlug,concern:'skin_anti_ageing',answers:payload,patientInfo:{name:common!.answers.name,gender:common!.answers.gender}})});
      const data=await response.json();if(!response.ok)throw new Error(data.error??'Submission failed');
      localStorage.removeItem(antiAgeingStorageKey(clinicSlug));
      const completed=markConcernComplete(intake!,'ANTI_AGEING',data.assessmentId);
      localStorage.setItem(skinIntakeStorageKey(clinicSlug,common!.sessionId),JSON.stringify(completed));
      router.push(`/q/${clinicSlug}/skin/anti-ageing/processing/${data.assessmentId}`);
    }catch(caught){setError(caught instanceof Error?caught.message:'Submission failed');setSubmitting(false)}
  }

  return <div className={styles.shell}>
    <header className={styles.topbar}><span className={styles.brand}><i>✦</i> DR SKIN FACT</span><span className={styles.step}>Anti‑Ageing · Step {index+1} of {visible.length}</span></header>
    <div className={styles.progress} role="progressbar" aria-valuenow={index+1} aria-valuemax={visible.length}><i style={{width:`${Math.round((index+1)/visible.length*100)}%`}}/></div>
    <main className={styles.questionPage}>
      {currentId==='AA_13'
        ? <Review answers={draft.answers} ack={ack} setAck={setAck} go={go}/>
        : question&&<QuestionView question={question} answers={draft.answers} setAnswer={setAnswer} select={select} clinicSlug={clinicSlug} sessionId={draft.patientSessionId} preview={preview}/>}
      {error&&<p className={styles.error} role="alert">{error}</p>}
    </main>
    <footer className={styles.footer}><span><ShieldCheck size={14}/> Progress is saved to this patient session</span><div><button className={styles.secondary} onClick={back}><ArrowLeft size={16}/> Back</button>{currentId==='AA_13'?<button className={styles.primary} onClick={()=>void submit()} disabled={submitting}>{submitting?'Submitting…':'Submit for Clinical Review'} <ArrowRight size={16}/></button>:<button className={styles.primary} onClick={next}>Continue <ArrowRight size={16}/></button>}</div></footer>
  </div>;
}

function QuestionView({question,answers,setAnswer,select,clinicSlug,sessionId,preview}:{question:Question;answers:AntiAgeingAnswers;setAnswer:(id:string,value:AntiAgeingAnswers[string])=>void;select:(q:Question,value:string)=>void;clinicSlug:string;sessionId:string;preview:boolean}){
  const answer=answers[question.id];
  const setImage=(view:string,ref?:AntiAgeingStorageReference)=>{const current=(answers.AA_10??{}) as Record<string,AntiAgeingStorageReference>;const next={...current};if(ref)next[view]=ref;else delete next[view];setAnswer('AA_10',next)};
  return <section className={styles.question}><div className={styles.phase}><p className={styles.eyebrow}>{PHASES[question.id]}</p><p className={styles.eyebrow}>{question.id.replace('_','-')}</p></div><h1>{question.title}</h1><p className={styles.instruction}>{question.instruction}</p><div className={styles.card}>
    {(question.type==='single_select'||question.type==='multi_select')&&<div className={styles.options} role={question.type==='multi_select'?'group':'radiogroup'}>{question.options?.map((option)=>{const active=Array.isArray(answer)?answer.includes(option.value):answer===option.value;return <button type="button" key={option.value} className={`${styles.option} ${active?styles.selected:''}`} aria-checked={active} role={question.type==='multi_select'?'checkbox':'radio'} onClick={()=>select(question,option.value)}>{active?<Check size={15}/>:<Sparkles size={14}/>} {option.label}</button>})}</div>}
    {question.type==='textarea'&&<VoiceTextField className={styles.textArea} value={String(answer??'')} onChange={(value)=>setAnswer(question.id,value)} placeholder="Type your answer here…" ariaLabel={question.title}/>}
    {question.id==='AA_09'&&<DocumentUploads value={(answers.AA_09??[]) as AntiAgeingStorageReference[]} onChange={(value)=>setAnswer('AA_09',value)} clinicSlug={clinicSlug} sessionId={sessionId} preview={preview}/>}
    {question.id==='AA_10'&&<><p className={styles.privacy}><ShieldCheck size={16}/> Adding clear photos is optional, but it can help the clinical team understand your concern more accurately and support the best possible outcome.</p><div className={styles.uploadGrid}>{requiredAntiAgeingImageViews.map((view)=><UploadSlot key={view} label={VIEW_LABELS[view]} view={view} questionId={`AA_10_${view}`} value={(answers.AA_10 as Record<string,AntiAgeingStorageReference>|undefined)?.[view]} onChange={(ref)=>setImage(view,ref)} clinicSlug={clinicSlug} sessionId={sessionId} preview={preview}/>)}</div><p className={styles.privacy}><ShieldCheck size={16}/> Clinical images are stored securely and are visible only to authorised reviewers.</p></>}
    {question.id==='AA_12'&&answer==='yes'&&<p className={styles.note}><Sparkles size={16}/> Educational video content will be available after clinical review.</p>}
  </div></section>;
}

function Review({answers,ack,setAck,go}:{answers:AntiAgeingAnswers;ack:boolean;setAck:(value:boolean)=>void;go:(id:string)=>void}){
  const clean=pruneHiddenAntiAgeingAnswers(answers);
  return <section className={styles.review}><p className={styles.eyebrow}>AA‑13 · Review</p><h1>Review your Anti‑Ageing assessment</h1><p className={styles.instruction}>Check your factual answers before sending them to the clinical team.</p><div className={`${styles.card} ${styles.reviewGrid}`}>{Object.entries(clean).filter(([id])=>LABELS[id]).map(([id,value])=><button type="button" className={styles.reviewRow} key={id} onClick={()=>go(id)}><b>{LABELS[id]} · Edit</b><p>{format(value)}</p></button>)}<label className={styles.ack}><input type="checkbox" checked={ack} onChange={(event)=>setAck(event.target.checked)}/><span>I understand that my answers and images will be reviewed by an authorised clinical team. This questionnaire does not provide a diagnosis, prescription or treatment recommendation.</span></label></div></section>;
}

function format(value:unknown){
  if(Array.isArray(value))return value.length&&typeof value[0]==='object'?`${value.length} document${value.length===1?'':'s'} uploaded`:value.join(', ').replaceAll('_',' ');
  if(value&&typeof value==='object')return `${Object.keys(value).length} secure image references`;
  return String(value??'Not provided').replaceAll('_',' ');
}

function DocumentUploads({value,onChange,clinicSlug,sessionId,preview}:{value:AntiAgeingStorageReference[];onChange:(value:AntiAgeingStorageReference[])=>void;clinicSlug:string;sessionId:string;preview:boolean}){
  return <div><div className={styles.documentList}>{value.map((doc)=><div className={styles.document} key={doc.path}><span><FileUp size={14}/> {doc.fileName}</span><button aria-label={`Remove ${doc.fileName}`} onClick={()=>onChange(value.filter((item)=>item.path!==doc.path))}><Trash2 size={14}/></button></div>)}</div>{value.length<4&&<UploadSlot label="Add optional document" view="DOCUMENT" questionId={`AA_09_${value.length+1}`} onChange={(ref)=>ref&&onChange([...value,ref])} clinicSlug={clinicSlug} sessionId={sessionId} preview={preview} acceptDocuments/>}</div>;
}

function UploadSlot({label,view,questionId,value,onChange,clinicSlug,sessionId,preview,acceptDocuments=false}:{label:string;view:AntiAgeingUploadView;questionId:string;value?:AntiAgeingStorageReference;onChange:(value?:AntiAgeingStorageReference)=>void;clinicSlug:string;sessionId:string;preview:boolean;acceptDocuments?:boolean}){
  const input=useRef<HTMLInputElement>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function upload(file:File){
    const allowed=acceptDocuments?['image/jpeg','image/png','image/webp','image/heic','application/pdf']:['image/jpeg','image/png','image/webp','image/heic'];
    if(!allowed.includes(file.type)){setError('Use PDF, JPEG, PNG, WebP or HEIC.');return}
    if(file.size<=0||file.size>6*1024*1024){setError('File must be smaller than 6 MB.');return}
    setBusy(true);setError('');
    try{
      if(preview){onChange({kind:'supabase_storage',bucket:'clinical-images',path:`preview/${sessionId}/${questionId}/${file.name}`,sessionId,questionId,view,fileName:file.name,mimeType:file.type,size:file.size,uploadedAt:new Date().toISOString()});return}
      const signed=await fetch('/api/upload/questionnaire',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clinicSlug,sessionId,questionId,fileName:file.name,contentType:file.type,fileSize:file.size})});
      const data=await signed.json();if(!signed.ok)throw new Error(data.error??'Could not prepare upload');
      await new Promise<void>((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('PUT',data.signedUrl);xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error('Upload failed'));xhr.onerror=()=>reject(new Error('Upload failed'));const form=new FormData();form.append('cacheControl','3600');form.append('',file);xhr.send(form)});
      onChange({kind:'supabase_storage',bucket:'clinical-images',path:data.path,sessionId,questionId,view,fileName:file.name,mimeType:file.type,size:file.size,uploadedAt:new Date().toISOString()});
    }catch(caught){setError(caught instanceof Error?caught.message:'Upload failed')}finally{setBusy(false)}
  }
  return <div className={styles.upload}>{value?<><Check size={23}/><strong>{label}</strong><small>{value.fileName}</small><button onClick={()=>onChange(undefined)}><Trash2 size={14}/> Remove</button></>:<><ImagePlus size={26}/><strong>{label}</strong><small>{acceptDocuments?'Optional · up to 6 MB':'Optional · even light · no filters'}</small><button onClick={()=>input.current?.click()} disabled={busy}>{busy?<LoaderCircle size={15}/>:'Choose file'}</button></>}<input ref={input} type="file" accept={acceptDocuments?'image/jpeg,image/png,image/webp,image/heic,application/pdf':'image/jpeg,image/png,image/webp,image/heic'} onChange={(event)=>{const file=event.target.files?.[0];if(file)void upload(file)}}/>{error&&<small className={styles.error}>{error}</small>}</div>;
}
