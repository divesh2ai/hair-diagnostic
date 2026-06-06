import React from "react";
import { QuizAnswer, Sex } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Avatar3D } from "./Avatar3D";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { 
  ArrowRight, 
  Camera, 
  Check, 
  ChevronRight, 
  Info, 
  Mic, 
  MicOff, 
  Plus, 
  User, 
  X,
  ZoomIn
} from "lucide-react";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface QuizProps {
  onComplete: (answers: QuizAnswer) => void;
}

const STEP_IMAGES: Record<string, string> = {
  name: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=600",
  phone: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=600",
  age: "https://images.unsplash.com/photo-1501139083538-0139583c060f?auto=format&fit=crop&q=80&w=600",
  sex: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=600",
  goal: "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&q=80&w=600",
  duration: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&q=80&w=600",
  count: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=600",
  hairtype: "https://images.unsplash.com/photo-1595959183075-c1d09e77bf19?auto=format&fit=crop&q=80&w=600",
  scalp: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a3ef?auto=format&fit=crop&q=80&w=600",
  cause: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&q=80&w=600",
  immunity: "https://images.unsplash.com/photo-1530026405186-ed1ea0ac7a63?auto=format&fit=crop&q=80&w=600",
  lifestyle: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&q=80&w=600",
  thyroid: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=600",
  hormonal: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&q=80&w=600",
  gut: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=600",
  deficiency: "https://images.unsplash.com/photo-1610970881699-44a5587cabec?auto=format&fit=crop&q=80&w=600",
  diet: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&q=80&w=600",
  treatment: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&q=80&w=600",
  grade: "https://images.unsplash.com/photo-1505944275655-e157ff9d3e9d?auto=format&fit=crop&q=80&w=600",
  extra: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=600"
};

const STEPS = [
  { id: "name", type: "text", q: "What is your full name?", placeholder: "Your name" },
  { id: "phone", type: "text", q: "What is your WhatsApp number?", placeholder: "+91 00000 00000" },
  { id: "age", type: "number", q: "How old are you?", placeholder: "Your age in years" },
  {
    id: "sex",
    type: "choice",
    q: "What is your gender?",
    opts: ["Male", "Female", "Other"],
    icons: ["👨", "👩", "🧑"],
  },
  {
    id: "goal",
    type: "choice",
    q: "What is your primary goal?",
    opts: [
      "Reduce hair fall and improve growth",
      "Hair fall is stopped but need to regrow lost hair",
      "Increase the thickness",
      "Maintain current hair health",
      "Early greying of hair",
    ],
    icons: ["🛑", "🌱", "💪", "🛡️", "🩶"],
  },
  {
    id: "duration",
    type: "choice",
    q: "How long have you been experiencing hair loss?",
    opts: ["1–3 months", "3–6 months", "6–12 months", "More than 1 year"],
    icons: ["🗓️", "📅", "🕐", "⏳"],
  },
  {
    id: "count",
    type: "choice",
    q: "How much hair do you lose per day?",
    opts: [
      "~20–50 strands (Normal range)",
      "~50–100 strands (Noticeable)",
      "100+ strands (Heavy loss)",
      "Just thinning, no visible fall",
    ],
    icons: ["🤏", "✋", "🫲", "🔍"],
  },
  {
    id: "hairtype",
    type: "multi",
    q: "What type of hair fall are you seeing?",
    opts: [
      "Full-length hairs with white bulb",
      "Broken short hair strands",
      "Hair on pillow / floor / shower",
      "Widening parting or thinning",
      "Circular bald patches",
      "None of the above",
    ],
  },
  {
    id: "scalp",
    type: "multi",
    q: "What's your scalp like right now?",
    opts: [
      "Dandruff / white flakes",
      "Oily scalp",
      "Dry scalp",
      "Redness or irritation",
      "Boils or pimples",
      "Burning sensation",
      "Normal scalp",
    ],
  },
  {
    id: "cause",
    type: "multi",
    q: "What do you think is the cause for your hair loss?",
    opts: [
      "Stress / Anxiety / Depression",
      "Genetics / Family history",
      "Nutritional deficiencies",
      "Medication / Recent Illness / Surgery",
      "Post partum — still feeding",
      "Post partum — not feeding",
      "Hair pulling habit (Trichotillomania)",
      "Hard water",
      "Post GLP-1 receptor agonist",
      "Post crash diet",
      "Not sure",
      "None of the above",
    ],
  },
  {
    id: "immunity",
    type: "multi",
    q: "Any immunity or skin-related issues?",
    opts: [
      "Frequent infections / cold / fever",
      "Allergies",
      "Asthma",
      "Skin rashes or eczema",
      "Alopecia Areata (circular patches)",
      "Scarring alopecia",
      "Mouth ulcers",
      "None of the above",
    ],
  },
  {
    id: "lifestyle",
    type: "multi",
    q: "How is your lifestyle?",
    opts: [
      "Smoking / Vaping",
      "Alcohol",
      "Bodybuilding / Heavy gym",
      "Obesity / Sedentary / Struggle to lose weight",
      "Erratic / Outside eating (10–12×/month)",
      "Night shift work",
      "Frequent flying",
      "None of the above",
    ],
  },
  {
    id: "thyroid",
    type: "multi",
    q: "Do you have either of the following conditions?",
    opts: ["Hypothyroidism", "Hyperthyroidism", "Pre diabetes", "Diabetes", "Not Applicable"],
  },
  {
    id: "hormonal",
    type: "multi",
    q: "Any hormonal or reproductive health issues? (Females)",
    opts: [
      "Thyroid disorder",
      "PCOS / PCOD only",
      "PCOS / PCOD + Obesity",
      "Endometriosis",
      "Currently pregnant",
      "Post-delivery or breastfeeding",
      "Peri-menopause",
      "Menopause",
      "Hormone Replacement Therapy (HRT)",
      "None of the above",
    ],
  },
  {
    id: "gut",
    type: "multi",
    q: "Any gut or digestive issues?",
    opts: [
      "Bloating / gas",
      "Constipation",
      "IBS / Crohn's",
      "Acid reflux / GERD",
      "Poor nutrient absorption",
      "No gut issues",
    ],
  },
  {
    id: "deficiency",
    type: "multi",
    q: "Any confirmed nutritional deficiencies?",
    opts: ["Iron / Anaemia", "Vitamin D3", "Vitamin B12", "None / Not tested"],
  },
  {
    id: "diet",
    type: "multi",
    q: "What best describes your diet?",
    opts: [
      "Vegetarian",
      "Vegan",
      "Non-vegetarian",
      "High protein diet",
      "Irregular / poor diet",
      "Crash Diet / Keto / IF",
      "None of the above",
    ],
  },
  {
    id: "treatment",
    type: "multi",
    q: "Any heat or chemical treatments on your hair?",
    opts: [
      "Heat styling (straightener etc.)",
      "Chemical treatment (colour / keratin)",
      "No heat or chemical treatments",
    ],
  },
  {
    id: "grade",
    type: "choice",
    q: "Which image best describes your hair loss / hair fall?",
    opts: [
      "Stage-1",
      "Stage-2",
      "Stage-3",
      "Stage-4",
      "Stage-5",
      "Stage-6",
      "Coin Size Patch",
      "Heavy Hair Fall"
    ],
  },
  { id: "extra", type: "textarea", q: "Anything else Dr. FACT should know? (optional)", placeholder: "Any other symptoms, medical history, treatments tried..." },
];

export const Quiz: React.FC<QuizProps> = ({ onComplete }) => {
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<Partial<QuizAnswer>>({
    hairtype: [],
    thyroid: [],
    cause: [],
    scalp: [],
    immunity: [],
    lifestyle: [],
    hormonal: [],
    gut: [],
    deficiency: [],
    diet: [],
    treatment: [],
  });
  const [inputValue, setInputValue] = React.useState("");
  const [isRecording, setIsRecording] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const recognitionRef = React.useRef<any>(null);

  React.useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    const initialInput = inputValue;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setInputValue(initialInput ? initialInput + ' ' + currentTranscript : currentTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const currentStep = STEPS[step];

  const renderOptionVisual = (stepId: string, opt: string) => {
    if (stepId === "count") {
      if (opt.includes("20")) {
        return <Visuals.HairClump20 className="w-14 h-14 object-contain" />;
      }
      if (opt.includes("50") || opt.includes("40")) {
        return <Visuals.HairClump50 className="w-14 h-14 object-contain" />;
      }
      if (opt.includes("100")) {
        return <Visuals.HairClump100 className="w-14 h-14 object-contain" />;
      }
      return <Visuals.HairThinningProfile className="w-14 h-14 object-contain" />;
    }
    
    if (stepId === "grade") {
      if (opt === "Stage-1") return <Visuals.NorwoodStage1 className="w-24 h-11 object-contain" />;
      if (opt === "Stage-2") return <Visuals.NorwoodStage2 className="w-24 h-11 object-contain" />;
      if (opt === "Stage-3") return <Visuals.NorwoodStage3 className="w-24 h-11 object-contain" />;
      if (opt === "Stage-4") return <Visuals.NorwoodStage4 className="w-24 h-11 object-contain" />;
      if (opt === "Stage-5") return <Visuals.NorwoodStage5 className="w-24 h-11 object-contain" />;
      if (opt === "Stage-6") return <Visuals.NorwoodStage6 className="w-24 h-11 object-contain" />;
      if (opt === "Coin Size Patch") return <Visuals.AlopeciaPatch className="w-14 h-14 object-contain" />;
      if (opt === "Heavy Hair Fall") return <Visuals.GeneralThinningPattern className="w-14 h-14 object-contain" />;
    }

    if (stepId === "hairtype") {
      if (opt.includes("Widening")) return <Visuals.PartitionWidening className="w-14 h-14 object-contain" />;
      if (opt.includes("Circular")) return <Visuals.AlopeciaPatch className="w-14 h-14 object-contain" />;
      if (opt.includes("broken") || opt.includes("Broken")) return <Visuals.HairThinningProfile className="w-14 h-14 object-contain" />;
    }

    if (stepId === "scalp") {
      if (opt.includes("Dandruff")) return <Visuals.DandruffSevere className="w-14 h-14 object-contain" />;
      if (opt.includes("irritation") || opt.includes("Redness")) return <Visuals.ScalpItchy className="w-14 h-14 object-contain" />;
      if (opt.includes("Boils") || opt.includes("pimples")) return <Visuals.ScalpPlaques className="w-14 h-14 object-contain" />;
      if (opt.includes("Dry")) return <Visuals.DandruffMild className="w-14 h-14 object-contain" />;
      if (opt.includes("Burning")) return <Visuals.ScalpItchy className="w-14 h-14 object-contain" />;
      return <Visuals.DandruffClear className="w-14 h-14 object-contain" />;
    }

    return null;
  };

  const handleFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setAnswers({ ...answers, scalpImg: ev.target?.result as string });
      reader.readAsDataURL(file);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleNext = (val?: any) => {
    const stepId = currentStep.id as keyof QuizAnswer;
    let finalVal = val;
    
    if (val === undefined && (currentStep.type === "text" || currentStep.type === "number" || currentStep.type === "textarea")) {
      finalVal = currentStep.type === "number" ? Number(inputValue) : inputValue;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    }

    const updatedAnswers = { ...answers, [stepId]: finalVal };
    setAnswers(updatedAnswers);
    setInputValue("");

    if (step < STEPS.length - 1) {
      let nextStep = step + 1;
      // Skip hormonal for males
      if (STEPS[nextStep].id === "hormonal" && updatedAnswers.sex === "Male") {
        updatedAnswers.hormonal = ["None of the above"];
        nextStep++;
      }
      setStep(nextStep);
    } else {
      onComplete(updatedAnswers as QuizAnswer);
    }
  };

  const toggleMulti = (opt: string) => {
    const stepId = currentStep.id as keyof QuizAnswer;
    const current = (answers[stepId] as string[]) || [];
    const isNone = opt.includes("None") || opt.includes("No ") || opt.includes("Not Applicable");
    
    let updated;
    if (isNone) {
      updated = [opt];
    } else {
      updated = current.filter(x => !x.includes("None") && !x.includes("No ") && !x.includes("Not Applicable"));
      if (updated.includes(opt)) {
        updated = updated.filter(x => x !== opt);
      } else {
        updated.push(opt);
      }
    }
    
    setAnswers({ ...answers, [stepId]: updated });
  };

  const progress = Math.round((step / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-[#faf7f2] flex flex-col font-serif text-[#0c1a0e]">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-[#eef4ee] z-50">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-[#2a5c3a]"
        />
      </div>

      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-white border-b border-[#ddd8cc]">
        <div className="flex items-center gap-3">
          <Avatar3D className="w-12 h-12" />
          <div>
            <div className="text-sm font-medium">Dr. FACT</div>
            <div className="text-[8px] uppercase tracking-widest text-[#2a5c3a] font-sans font-bold">AI Trichologist</div>
          </div>
        </div>
        <div className="text-[10px] font-sans font-bold text-[#aaa] uppercase tracking-widest">
          Step {step + 1} / {STEPS.length}
        </div>
      </header>

      {/* Quiz Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 flex items-center justify-center">
        <div className="bg-white rounded-[2rem] overflow-hidden border border-[#ddd8cc] shadow-2xl flex flex-col md:flex-row w-full min-h-[550px]">
          
          {/* Visual Panel Column */}
          <div className="w-full md:w-1/2 relative bg-[#0c1a0e] overflow-hidden min-h-[220px] md:min-h-0 flex-shrink-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 0.9, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 w-full h-full"
              >
                <img 
                  src={STEP_IMAGES[currentStep.id] || STEP_IMAGES.extra}
                  alt={currentStep.q}
                  className="w-full h-full object-cover opacity-80"
                  referrerPolicy="no-referrer"
                />
                {/* Visual medical overlay grading gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c1a0e] via-[#0c1a0e]/20 to-transparent" />
                
                {/* Beautiful question/quote text decoration on full screen */}
                <div className="absolute bottom-6 left-6 right-6 text-white font-sans text-[10px] uppercase tracking-widest opacity-60">
                  Dr. FACT Clinical Intelligence // Parameter Assessment
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Form Content Column */}
          <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col justify-center bg-gradient-to-br from-white to-[#fffdf5]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.3 }}
                className="w-full space-y-6 md:space-y-8"
              >
                <div className="space-y-3">
                  <div className="inline-block px-3 py-1 rounded-full bg-[#eef4ee] text-[#2a5c3a] text-[9px] font-sans font-bold uppercase tracking-widest">
                    Section {Math.ceil((step + 1) / 5)} // {currentStep.id.toUpperCase()}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-medium leading-tight">
                    {currentStep.q}
                  </h2>
                </div>

                <div className="space-y-4">
                  {currentStep.type === "choice" && (
                    <div className={cn(
                      "grid gap-3 w-full",
                      currentStep.id === "grade" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
                    )}>
                      {currentStep.opts?.map((opt, i) => {
                        const visual = renderOptionVisual(currentStep.id, opt);
                        return (
                          <button
                            key={i}
                            onClick={() => handleNext(opt)}
                            className={cn(
                              "group flex items-center justify-between p-4 rounded-2xl border border-[#ddd8cc] bg-white hover:border-[#2a5c3a] hover:bg-[#f7fbf7] hover:shadow-md transition-all text-left",
                              currentStep.id === "grade" ? "p-3" : "p-4"
                            )}
                          >
                            <div className="flex items-center gap-4 w-full">
                              {visual ? (
                                <div className="p-1 bg-[#fffdf9] rounded-xl border border-[#ddd8cc]/40 flex-shrink-0 flex items-center justify-center">
                                  {visual}
                                </div>
                              ) : currentStep.icons ? (
                                <span className="text-xl flex-shrink-0">{currentStep.icons[i]}</span>
                              ) : null}
                              <span className="text-sm font-semibold font-sans text-gray-800 leading-tight">
                                {opt}
                              </span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#ddd8cc] group-hover:text-[#2a5c3a] transition-colors flex-shrink-0 ml-2" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {currentStep.type === "multi" && (
                    <div className="space-y-6 w-full">
                      <div className={cn(
                        "grid gap-3 max-h-[350px] overflow-y-auto pr-1 w-full",
                        (currentStep.id === "scalp" || currentStep.id === "hairtype") ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
                      )}>
                        {currentStep.opts?.map((opt, i) => {
                          const isSelected = ((answers[currentStep.id as keyof QuizAnswer] as string[]) || []).includes(opt);
                          const visual = renderOptionVisual(currentStep.id, opt);
                          return (
                            <button
                              key={i}
                              onClick={() => toggleMulti(opt)}
                              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left group ${
                                isSelected 
                                  ? "border-[#2a5c3a] bg-[#f7fbf7] text-[#2a5c3a] shadow-sm" 
                                  : "border-[#ddd8cc] bg-white hover:border-[#2a5c3a] hover:shadow-sm"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {visual ? (
                                  <div className="p-1 bg-[#fffdf9] rounded-xl border border-[#ddd8cc]/40 flex-shrink-0 flex items-center justify-center">
                                    {visual}
                                  </div>
                                ) : null}
                                <span className="text-xs font-sans font-medium">{opt}</span>
                              </div>
                              {isSelected ? (
                                <Check className="w-3.5 h-3.5 flex-shrink-0 text-[#2a5c3a]" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => handleNext()}
                        className="w-full py-3.5 bg-[#2a5c3a] text-white rounded-2xl font-sans font-bold uppercase tracking-widest shadow-lg shadow-[#2a5c3a]/20 flex items-center justify-center gap-2 text-xs"
                      >
                        Continue <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {(currentStep.type === "text" || currentStep.type === "number" || currentStep.type === "textarea") && (
                    <div className="space-y-6">
                      <div className="relative">
                        {currentStep.type === "textarea" ? (
                          <textarea
                            autoFocus
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={currentStep.placeholder}
                            className="w-full p-5 pr-14 rounded-2xl border border-[#ddd8cc] bg-white focus:border-[#2a5c3a] focus:ring-1 focus:ring-[#2a5c3a] outline-none font-sans min-h-[140px] text-base"
                          />
                        ) : (
                          <input
                            autoFocus
                            type={currentStep.type}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={currentStep.placeholder}
                            className="w-full p-5 pr-14 rounded-2xl border border-[#ddd8cc] bg-white focus:border-[#2a5c3a] focus:ring-1 focus:ring-[#2a5c3a] outline-none font-sans text-base"
                            onKeyDown={(e) => e.key === "Enter" && handleNext()}
                          />
                        )}
                        
                        <button
                          type="button"
                          onClick={toggleRecording}
                          className={`absolute ${currentStep.type === "textarea" ? "top-5" : "top-1/2 -translate-y-1/2"} right-4 p-2 rounded-full transition-colors ${
                            isRecording 
                              ? "bg-red-100 text-red-500 hover:bg-red-200" 
                              : "bg-[#eef4ee] text-[#2a5c3a] hover:bg-[#dce8dc]"
                          }`}
                          title={isRecording ? "Stop recording" : "Start recording"}
                        >
                          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                        
                        {currentStep.id === "extra" && (
                          <div 
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            className={`mt-4 p-5 border-2 border-dashed rounded-2xl transition-all flex flex-col items-center justify-center gap-3 ${
                              isDragging 
                                ? "border-[#2a5c3a] bg-[#f7fbf7] scale-[1.01]" 
                                : answers.scalpImg 
                                  ? "border-[#2a5c3a] bg-[#f7fbf7]/30" 
                                  : "border-[#ddd8cc] bg-white"
                            }`}
                          >
                            <div className="flex flex-col items-center text-center gap-1.5">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${answers.scalpImg ? "bg-[#2a5c3a] text-white" : "bg-[#eef4ee] text-[#2a5c3a]"}`}>
                                {answers.scalpImg ? <Check className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                              </div>
                              <div>
                                <div className="text-xs font-bold font-sans">
                                  {answers.scalpImg ? "Scalp Photo Received" : "Upload Scalp Photo"}
                                </div>
                                <p className="text-[9px] text-[#aaa] font-sans max-w-[220px]">
                                  {answers.scalpImg 
                                    ? "Dr. FACT will analyze this for inflammation." 
                                    : "Drag and drop or click to upload."}
                                </p>
                              </div>
                            </div>

                            <input 
                              type="file" 
                              id="scalp-upload" 
                              accept="image/*"
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFile(file);
                              }}
                            />
                            
                            <div className="flex gap-2">
                              <button 
                                type="button"
                                onClick={() => document.getElementById("scalp-upload")?.click()}
                                className="px-4 py-1.5 bg-[#2a5c3a] text-white rounded-xl text-[9px] font-bold font-sans uppercase tracking-wider shadow-md shadow-[#2a5c3a]/10"
                              >
                                {answers.scalpImg ? "Change Photo" : "Select Image"}
                              </button>
                              {answers.scalpImg && (
                                <button 
                                  type="button"
                                  onClick={() => setAnswers({ ...answers, scalpImg: undefined })}
                                  className="px-3 py-1.5 bg-white border border-[#ddd8cc] text-[#ff4444] rounded-xl text-[9px] font-bold font-sans uppercase tracking-wider"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <button
                        disabled={!inputValue && currentStep.id !== "extra"}
                        onClick={() => handleNext()}
                        className="w-full py-3.5 bg-[#2a5c3a] text-white rounded-2xl font-sans font-bold uppercase tracking-widest shadow-lg shadow-[#2a5c3a]/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none text-xs"
                      >
                        {currentStep.id === "extra" ? "Generate Diagnosis" : "Continue"} <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </main>

      {/* Footer Info */}
      <footer className="p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-[#aaa]">
          <Info className="w-3 h-3" />
          <span className="text-[10px] font-sans uppercase tracking-widest">Clinical Intelligence by The Fact Nutrition</span>
        </div>
      </footer>
    </div>
  );
};
