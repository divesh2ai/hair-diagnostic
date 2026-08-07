import { PigmentationProcessing } from '@/components/skin-fact/PigmentationProcessing';
export default async function Page({params}:{params:Promise<{clinicSlug:string;assessmentId:string}>}){const {clinicSlug,assessmentId}=await params;return <PigmentationProcessing clinicSlug={clinicSlug} assessmentId={assessmentId}/>}
