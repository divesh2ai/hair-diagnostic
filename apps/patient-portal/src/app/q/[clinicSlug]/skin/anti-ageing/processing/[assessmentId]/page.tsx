import { AntiAgeingProcessing } from '@/components/skin-fact/AntiAgeingProcessing';
export default async function Page({params}:{params:Promise<{clinicSlug:string;assessmentId:string}>}){const{clinicSlug,assessmentId}=await params;return <AntiAgeingProcessing clinicSlug={clinicSlug} assessmentId={assessmentId}/>}
