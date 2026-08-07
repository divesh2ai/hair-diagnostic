'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, FileText, ImagePlus, LoaderCircle, RotateCcw, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import {
  PIGMENTATION_PROTOCOL, buildPigmentationSubmission, commonStorageKey, createSessionId,
  isValidCommonState, isValidPigmentationDraft, pigmentationStorageKey, pruneHiddenPigmentationAnswers,
  requiredImageViews, visiblePigmentationStepIds, type CommonIntakeState, type PigmentationAnswers,
  type PigmentationDraft, type StorageReference, type UploadView,
} from '@/lib/skin-fact/pigmentation';
import { loadSkinCommonProfile, loadSkinFactIntake, markConcernComplete, nextIncompleteConcern, skinIntakeStorageKey, type SkinFactIntake } from '@/lib/skin-fact/skinJourney';
import styles from './pigmentation.module.css';
import { VoiceTextField } from './VoiceTextField';

type ProtocolQuestion = (typeof PIGMENTATION_PROTOCOL.questions)[number];
const PHASES: Record<string, string> = { PIG_01:'Pigmentation History',PIG_02:'Pigmentation History',PIG_03:'Pigmentation History',PIG_04:'Pigmentation History',PIG_05:'Previous Care',PIG_06:'Previous Care',PIG_07:'Your Skin',PIG_08:'Your Skin',PIG_09:'Your Skin',PIG_11:'Previous Care',PIG_12:'Previous Care',PIG_13:'Previous Care',PIG_14:'Clinical Images',PIG_15:'Consultation',REVIEW:'Review' };
const VIEW_LABELS: Record<UploadView,string> = { FRONT:'Front view',LEFT:'Left-side view',RIGHT:'Right-side view',BODY:'Affected body area',PRESCRIPTION:'Previous prescription' };

export function PigmentationQuestionnaire() {
  const clinicSlug = String(useParams().clinicSlug ?? '');
  const router = useRouter();
  const [common,setCommon] = useState<CommonIntakeState|null>(null);
  const [intake,setIntake] = useState<SkinFactIntake|null>(null);
  const [draft,setDraft] = useState<PigmentationDraft|null>(null);
  const [loaded,setLoaded] = useState(false);
  const [error,setError] = useState('');
  const [acknowledged,setAcknowledged] = useState(false);
  const [submitting,setSubmitting] = useState(false);

  useEffect(()=>{
    const commonRaw=loadSkinCommonProfile(localStorage,clinicSlug);
    if(!commonRaw?.completedAt){router.replace(`/q/${clinicSlug}/skin/intake?next=concerns`);return}
    const journey=loadSkinFactIntake(localStorage,clinicSlug,commonRaw.sessionId);
    if(!journey||!journey.selectedConcerns.includes('PIGMENTATION')){router.replace(`/q/${clinicSlug}/skin/concerns`);return}
    let draftRaw:unknown=null;
    try{draftRaw=JSON.parse(localStorage.getItem(pigmentationStorageKey(clinicSlug,journey.intakeId))??'null')}catch{}
    setCommon(commonRaw);
    setIntake(journey);
    const validDraft=isValidPigmentationDraft(draftRaw,clinicSlug)&&draftRaw.skinIntakeId===journey.intakeId?draftRaw:null;
    setDraft(validDraft??{productType:'SKIN_FACT',concernType:'PIGMENTATION',protocolId:'skin-pigmentation',protocolVersion:'1.0.0',clinicSlug,sessionId:createSessionId(),commonIntakeId:commonRaw.sessionId,skinIntakeId:journey.intakeId,selectedConcernCount:journey.selectedConcerns.length,stepId:'PIG_01',answers:{}});
    setLoaded(true);
  },[clinicSlug,router]);

  useEffect(()=>{if(loaded&&draft)localStorage.setItem(pigmentationStorageKey(clinicSlug,draft.skinIntakeId),JSON.stringify(draft))},[clinicSlug,draft,loaded]);
  const visible = useMemo(()=>visiblePigmentationStepIds(draft?.answers??{}),[draft?.answers]);
  const currentId = draft&&visible.includes(draft.stepId)?draft.stepId:visible[0];
  const index = Math.max(0,visible.indexOf(currentId));
  const question = PIGMENTATION_PROTOCOL.questions.find((item)=>item.id===currentId) as ProtocolQuestion|undefined;
  const progress = Math.round(((index+1)/visible.length)*100);
  if(!loaded||!draft||!common||!intake)return <main className={styles.loading}>Loading Pigmentation assessmentâ€¦</main>;

  const setAnswer=(id:string,value:PigmentationAnswers[string])=>{setError('');setDraft((current)=>current?{...current,answers:{...current.answers,[id]:value}}:current)};
  const selected=(id:string)=>draft!.answers[id];
  const goTo=(id:string)=>setDraft((current)=>current?{...current,stepId:id}:current);

  function selectOption(q:ProtocolQuestion,value:string){
    if(q.type==='multi_select'){
      const current=Array.isArray(selected(q.id))?selected(q.id) as string[]:[];
      const exclusive='exclusiveValue' in q?q.exclusiveValue:undefined;
      const next=current.includes(value)?current.filter((item)=>item!==value):value===exclusive?[value]:[...current.filter((item)=>item!==exclusive),value];
      setAnswer(q.id,next);return;
    }
    setAnswer(q.id,value);
  }

  function validateCurrent(){
    const a=draft!.answers;let message='';
    if(currentId==='REVIEW'){if(!acknowledged)message='Please confirm the clinical-review acknowledgement before submitting.';setError(message);return !message}
    if(question?.required){const value=a[currentId];if(value===undefined||value===''||(Array.isArray(value)&&value.length===0))message='Please complete this question before continuing.'}
    if(currentId==='PIG_02'&&Array.isArray(a.PIG_02)&&a.PIG_02.includes('body_other')&&!String(a.PIG_02_BODY_LOCATION??'').trim())message='Please specify the affected body area.';
    if(currentId==='PIG_07'&&a.PIG_07==='yes'&&!String(a.PIG_07_MEDICATION_DETAILS??'').trim())message='Please specify the medicine and condition.';
    if(currentId==='PIG_08'&&a.PIG_08==='yes'&&!String(a.PIG_08_MEDICAL_HISTORY_DETAILS??'').trim())message='Please describe the relevant medical history.';
    if(currentId==='PIG_12'&&Array.isArray(a.PIG_12)&&a.PIG_12.includes('other_treatment')&&!String(a.PIG_12_OTHER_TREATMENT??'').trim())message='Please specify the other treatment.';
    setError(message);return !message;
  }

  function next(){if(!validateCurrent())return;if(index<visible.length-1)goTo(visible[index+1]);}
  function back(){setError('');if(index>0)goTo(visible[index-1]);else router.push(`/q/${clinicSlug}/skin/pigmentation`)}

  async function submit(){
    if(!validateCurrent())return;setSubmitting(true);setError('');
    const clean={...draft!,answers:pruneHiddenPigmentationAnswers(draft!.answers)};
    try{const response=await fetch('/api/assessment/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clinicSlug,concern:'skin_pigmentation',answers:buildPigmentationSubmission(common!,clean),patientInfo:{name:common!.answers.name,gender:common!.answers.gender}})});const data=await response.json();if(!response.ok)throw new Error(data.error??'Submission failed');localStorage.removeItem(pigmentationStorageKey(clinicSlug,draft!.skinIntakeId));const completed=markConcernComplete(intake!,'PIGMENTATION',data.assessmentId);localStorage.setItem(skinIntakeStorageKey(clinicSlug,common!.sessionId),JSON.stringify(completed));const upcoming=nextIncompleteConcern(completed);router.push(upcoming?`/q/${clinicSlug}/skin/transition?from=PIGMENTATION&next=${upcoming}`:`/q/${clinicSlug}/skin/complete`)}catch(caught){setError(caught instanceof Error?caught.message:'Submission failed');setSubmitting(false)}
  }

  return <div className={styles.shell}>
    <header className={styles.topbar}><div><span className={styles.brandMark}><Sparkles size={15}/></span><strong>DR SKIN FACT</strong></div><span>{intake.selectedConcerns.length > 1 ? `Concern ${intake.currentConcernIndex + 1} of ${intake.selectedConcerns.length} · Pigmentation · ` : 'PIGMENTATION ASSESSMENT · '}Step {index+1} of {visible.length}</span></header>
    <div className={styles.progress} role="progressbar" aria-label={`Pigmentation assessment step ${index+1} of ${visible.length}`} aria-valuenow={index+1} aria-valuemax={visible.length}><i style={{width:`${progress}%`}}/></div>
    <main className={styles.questionPage}>
      {currentId==='REVIEW'?<ReviewScreen clinicSlug={clinicSlug} common={common} answers={draft.answers} onEdit={goTo} acknowledged={acknowledged} onAcknowledged={setAcknowledged}/>:question&&<QuestionScreen question={question} answers={draft.answers} setAnswer={setAnswer} selectOption={selectOption} clinicSlug={clinicSlug} sessionId={draft.sessionId}/>} 
      {error&&<p className={styles.error} role="alert" tabIndex={-1}>{error}</p>}
    </main>
    <footer className={styles.footer}><span><ShieldCheck size={14}/> Your progress is saved securely</span><div><button className={styles.secondary} onClick={back}><ArrowLeft size={16}/> Back</button>{currentId==='REVIEW'?<button className={styles.primary} onClick={()=>void submit()} disabled={submitting}>{submitting?'Submittingâ€¦':'Submit for Clinical Review'} <ArrowRight size={16}/></button>:<button className={styles.primary} onClick={next}>Continue <ArrowRight size={16}/></button>}</div></footer>
  </div>;
}

function QuestionScreen({question,answers,setAnswer,selectOption,clinicSlug,sessionId}:{question:ProtocolQuestion;answers:PigmentationAnswers;setAnswer:(id:string,value:PigmentationAnswers[string])=>void;selectOption:(q:ProtocolQuestion,value:string)=>void;clinicSlug:string;sessionId:string}){
  const answer=answers[question.id];
  const setClinical=(view:UploadView,value:StorageReference|undefined)=>{const current=(answers.PIG_14&&typeof answers.PIG_14==='object'&&!Array.isArray(answers.PIG_14)?answers.PIG_14:{}) as Record<string,StorageReference>;const next={...current};if(value)next[view]=value;else delete next[view];setAnswer('PIG_14',next)};
  return <><div className={styles.phaseMeta}><p className={styles.eyebrow}>{PHASES[question.id]}</p></div><h1>{question.title}</h1><p className={styles.questionInstruction}>{question.instruction}</p><section className={styles.formCard}>
    {question.id==='PIG_02'&&<PigmentationRegionMap selected={Array.isArray(answer)?answer:[]} onToggle={(value)=>selectOption(question,value)} />}
    {question.id!=='PIG_02'&&(question.type==='single_select'||question.type==='multi_select')&&'options' in question&&<div className={styles.optionsGrid} role={question.type==='multi_select'?'group':'radiogroup'}>{question.options?.map((option)=><button type="button" role={question.type==='multi_select'?'checkbox':'radio'} aria-checked={Array.isArray(answer)?answer.includes(option.value):answer===option.value} className={(Array.isArray(answer)?answer.includes(option.value):answer===option.value)?styles.selected:''} key={option.value} onClick={()=>selectOption(question,option.value)}>{(Array.isArray(answer)?answer.includes(option.value):answer===option.value)?<Check size={16}/>:<Sparkles size={15}/>}<span>{option.label}</span></button>)}</div>}
    {question.type==='textarea'&&<VoiceTextField className={styles.textArea} value={String(answer??'')} ariaLabel={question.title} onChange={(value)=>setAnswer(question.id,value)}/>}
    {question.id==='PIG_02'&&Array.isArray(answer)&&answer.includes('body_other')&&<label className={`${styles.field} ${styles.helperField}`}><span>Please specify the affected body area.</span><VoiceTextField multiline={false} value={String(answers.PIG_02_BODY_LOCATION??'')} ariaLabel="Affected body area" onChange={(value)=>setAnswer('PIG_02_BODY_LOCATION',value)}/></label>}
    {question.id==='PIG_07'&&answer==='yes'&&<label className={`${styles.field} ${styles.helperField}`}><span>Please specify the medicine and the condition it is being used for.</span><VoiceTextField value={String(answers.PIG_07_MEDICATION_DETAILS??'')} ariaLabel="Medicine and condition details" onChange={(value)=>setAnswer('PIG_07_MEDICATION_DETAILS',value)}/></label>}
    {question.id==='PIG_08'&&answer==='yes'&&<label className={`${styles.field} ${styles.helperField}`}><span>Please describe the relevant medical history.</span><VoiceTextField value={String(answers.PIG_08_MEDICAL_HISTORY_DETAILS??'')} ariaLabel="Medical history details" onChange={(value)=>setAnswer('PIG_08_MEDICAL_HISTORY_DETAILS',value)}/></label>}
    {question.id==='PIG_12'&&Array.isArray(answer)&&answer.includes('other_treatment')&&<label className={`${styles.field} ${styles.helperField}`}><span>Please specify the treatment.</span><VoiceTextField multiline={false} value={String(answers.PIG_12_OTHER_TREATMENT??'')} ariaLabel="Other treatment details" onChange={(value)=>setAnswer('PIG_12_OTHER_TREATMENT',value)}/></label>}
    {question.id==='PIG_13'&&answer==='upload'&&<div className={styles.helperField}><UploadSlot label="Previous prescription" view="PRESCRIPTION" questionId="PIG_13_PRESCRIPTION" acceptPdf clinicSlug={clinicSlug} sessionId={sessionId} value={answers.PIG_13_PRESCRIPTION as StorageReference|undefined} onChange={(value)=>setAnswer('PIG_13_PRESCRIPTION',value)}/></div>}
    {question.id==='PIG_14'&&<><p className={styles.privacy}><ShieldCheck size={16}/> Adding clear photos is optional, but it can help the clinical team understand your concern more accurately and support the best possible outcome.</p><div className={styles.uploadGrid}>{requiredImageViews(answers).map((view)=><UploadSlot key={view} label={VIEW_LABELS[view]} view={view} questionId={`PIG_14_${view}`} clinicSlug={clinicSlug} sessionId={sessionId} value={(answers.PIG_14 as Record<string,StorageReference>|undefined)?.[view]} onChange={(value)=>setClinical(view,value)}/>)}</div><p className={styles.privacy}><ShieldCheck size={16}/> Your images are stored securely and are visible only to the authorised clinical team reviewing your assessment.</p></>}
  </section></>;
}

function PigmentationRegionMap({selected,onToggle}:{selected:string[];onToggle:(value:string)=>void}){
  const regions=[
    {value:'forehead',label:'Forehead',number:1},
    {value:'temples',label:'Temples',number:2},
    {value:'periorbital',label:'Around the eyes',number:3},
    {value:'cheeks',label:'Cheeks',number:4},
    {value:'perioral',label:'Around the mouth',number:5},
    {value:'chin',label:'Chin',number:6},
  ];
  return <figure className={styles.regionSelector}>
    <div className={styles.regionSelectorHeading}><div><span>Select on the face</span><small>Tap every area where you notice pigmentation</small></div><strong>{selected.filter((value)=>value!=='body_other').length} selected</strong></div>
    <div className={styles.regionSelectorLayout}>
      <div className={styles.regionPortraitPhoto}>
        <img src="/skin-fact/pigmentation-face-selector.png" alt="Front-facing portrait showing clear facial regions" />
        {regions.map((region)=>{const active=selected.includes(region.value);return <button key={region.value} type="button" className={`${styles.regionHotspot} ${styles[`regionHotspot_${region.value}`]} ${active?styles.regionHotspotSelected:''}`} aria-pressed={active} aria-label={`${active?'Remove':'Select'} ${region.label}`} onClick={()=>onToggle(region.value)}><span>{active?<Check size={15}/>:region.number}</span><em>{region.label}</em></button>})}
      </div>
      <div className={styles.regionChoicePanel}>
        <p>Or choose from the list</p>
        <div className={styles.regionChoiceGrid}>{regions.map((region)=>{const active=selected.includes(region.value);return <button key={region.value} type="button" aria-pressed={active} className={active?styles.regionChoiceSelected:''} onClick={()=>onToggle(region.value)}><span>{active?<Check size={14}/>:region.number}</span>{region.label}</button>})}</div>
        <button type="button" aria-pressed={selected.includes('body_other')} className={`${styles.bodyRegionChoice} ${selected.includes('body_other')?styles.regionChoiceSelected:''}`} onClick={()=>onToggle('body_other')}><span>{selected.includes('body_other')?<Check size={14}/>:7}</span><div><b>Another area of the body</b><small>Choose this only for non-facial pigmentation</small></div></button>
      </div>
    </div>
    <figcaption>Selected areas are highlighted in rose-champagne. You can tap a marker or its matching option again to remove it.</figcaption>
  </figure>;
}

function UploadSlot({label,view,questionId,clinicSlug,sessionId,value,onChange,acceptPdf=false}:{label:string;view:UploadView;questionId:string;clinicSlug:string;sessionId:string;value?:StorageReference;onChange:(value:StorageReference|undefined)=>void;acceptPdf?:boolean}){
  const input=useRef<HTMLInputElement>(null);const [busy,setBusy]=useState(false);const [progress,setProgress]=useState(0);const [error,setError]=useState('');const [preview,setPreview]=useState('');const [retryFile,setRetryFile]=useState<File|null>(null);
  useEffect(()=>{if(!value){setPreview('');return}let cancelled=false;fetch(`/api/upload/questionnaire?clinicSlug=${encodeURIComponent(clinicSlug)}&sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(value.path)}`).then((r)=>r.ok?r.json():Promise.reject()).then((data)=>{if(!cancelled)setPreview(data.signedUrl)}).catch(()=>{if(!cancelled)setError('Preview unavailable. Retry or replace the file.')});return()=>{cancelled=true}},[clinicSlug,sessionId,value]);
  async function upload(file:File){const allowed=acceptPdf?['image/jpeg','image/png','image/webp','application/pdf']:['image/jpeg','image/png','image/webp'];if(!allowed.includes(file.type)){setError(acceptPdf?'Use PDF, JPEG, PNG, or WebP.':'Use JPEG, PNG, or WebP.');return}if(file.size<=0||file.size>4*1024*1024){setError('File must be between 1 byte and 4 MB.');return}setBusy(true);setError('');setProgress(4);setRetryFile(file);try{const signed=await fetch('/api/upload/questionnaire',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clinicSlug,sessionId,questionId,fileName:file.name,contentType:file.type,fileSize:file.size})});const data=await signed.json();if(!signed.ok)throw new Error(data.error??'Could not prepare upload');await new Promise<void>((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('PUT',data.signedUrl);xhr.upload.onprogress=(event)=>event.lengthComputable&&setProgress(Math.max(4,Math.round(event.loaded/event.total*100)));xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error('Upload failed'));xhr.onerror=()=>reject(new Error('Upload failed'));const form=new FormData();form.append('cacheControl','3600');form.append('',file);xhr.send(form)});const ref:StorageReference={kind:'supabase_storage',bucket:'clinical-images',path:data.path,sessionId,questionId,view,fileName:file.name,mimeType:file.type,size:file.size,uploadedAt:new Date().toISOString()};onChange(ref);setProgress(100);setRetryFile(null)}catch(caught){setError(caught instanceof Error?caught.message:'Upload failed')}finally{setBusy(false)}}
  async function remove(){if(value)await fetch('/api/upload/questionnaire',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({clinicSlug,sessionId,path:value.path})}).catch(()=>null);onChange(undefined);setPreview('');setRetryFile(null);if(input.current)input.current.value=''}
  return <article className={styles.uploadSlot}><header><strong>{label}</strong><span>{value?'UPLOAD COMPLETE':'OPTIONAL'}</span></header><input ref={input} hidden type="file" accept={acceptPdf?'application/pdf,image/jpeg,image/png,image/webp':'image/jpeg,image/png,image/webp'} onChange={(e)=>{const file=e.target.files?.[0];if(file)void upload(file)}}/>{value?<>{value.mimeType==='application/pdf'?<div className={styles.filePreview}><FileText size={36}/><span>{value.fileName}</span></div>:preview?<img className={styles.uploadPreview} src={preview} alt={`${label} preview`}/>:<div className={styles.filePreview}><LoaderCircle/></div>}<div className={styles.uploadActions}><button type="button" onClick={()=>input.current?.click()}><RotateCcw size={14}/> Replace</button><button type="button" onClick={()=>void remove()}><Trash2 size={14}/> Remove</button></div></>:<button type="button" className={styles.uploadDrop} disabled={busy} onClick={()=>input.current?.click()}><span>{busy?<LoaderCircle size={25}/>:<ImagePlus size={25}/>}<strong>{busy?'Uploading securelyâ€¦':'Capture or upload'}</strong><small>{acceptPdf?'PDF, JPEG, PNG, WebP':'JPEG, PNG, WebP'} Â· up to 4 MB</small></span></button>}{busy&&<div className={styles.uploadProgress} aria-label={`Upload ${progress}%`}><i style={{width:`${progress}%`}}/></div>}{error&&<><small className={styles.error} role="alert">{error}</small>{retryFile&&<button type="button" className={styles.secondary} onClick={()=>void upload(retryFile)}>Retry upload</button>}</>}</article>;
}

function ReviewScreen({clinicSlug,common,answers,onEdit,acknowledged,onAcknowledged}:{clinicSlug:string;common:CommonIntakeState;answers:PigmentationAnswers;onEdit:(id:string)=>void;acknowledged:boolean;onAcknowledged:(value:boolean)=>void}){
  const label=(id:string)=>{const value=answers[id];if(Array.isArray(value))return value.join(', ').replaceAll('_',' ');return String(value??'Not provided').replaceAll('_',' ')};
  const cards=[['Duration',label('PIG_01'),'PIG_01'],['Affected locations',label('PIG_02'),'PIG_02'],['Sun exposure',`${label('PIG_03')} Â· ${label('PIG_04')}`,'PIG_03'],['Products used',label('PIG_05'),'PIG_05'],['Medicines',`${label('PIG_07')} Â· ${label('PIG_07_MEDICATION_DETAILS')}`,'PIG_07'],['Medical history',`${label('PIG_08')} Â· ${label('PIG_08_MEDICAL_HISTORY_DETAILS')}`,'PIG_08'],['Acne history',label('PIG_09'),'PIG_09'],['Previous treatment',`${label('PIG_11')} Â· ${label('PIG_12')}`,'PIG_11'],['Previous prescription',answers.PIG_13_PRESCRIPTION?'Uploaded securely':'Not uploaded','PIG_13'],['Optional images',`${requiredImageViews(answers).length} suggested view(s)`,'PIG_14'],['Video consultation',label('PIG_15'),'PIG_15']];
  const returnTo=encodeURIComponent(`/q/${clinicSlug}/skin/pigmentation/assessment`);
  return <><div className={styles.reviewHero}><p className={styles.eyebrow}>Review</p><h1>Review your pigmentation assessment</h1><p className={styles.questionInstruction}>Check the factual information below. No diagnosis has been inferred.</p></div><article className={styles.reviewCard}><header><h2>Patient profile</h2><Link href={`/q/${clinicSlug}/skin/intake?edit=1&returnTo=${returnTo}`}>Edit profile</Link></header><p>{common.answers.name}, {common.answers.age} · {common.answers.gender} · {common.answers.skinType} skin · Sensitive: {common.answers.sensitiveSkin}</p></article><div className={styles.reviewGrid}>{cards.map(([title,copy,id])=><article className={styles.reviewCard} key={title}><header><h2>{title}</h2><button type="button" onClick={()=>onEdit(id)}>Edit</button></header><p>{copy}</p></article>)}</div><label className={styles.acknowledgement}><input type="checkbox" checked={acknowledged} onChange={(e)=>onAcknowledged(e.target.checked)}/><span>I understand that this questionnaire and the uploaded images support clinical review and do not confirm a final diagnosis by themselves.</span></label></>;
}
