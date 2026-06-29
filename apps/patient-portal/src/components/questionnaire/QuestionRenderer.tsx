'use client';

import { useState } from 'react';
import { Question } from '@/types/questionnaire';
import { ImageSelectCard } from './ImageSelectCard';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud } from 'lucide-react';

// ─── Input formatting helpers ───────────────────────────────────────────────

/** Title-case a name: collapses whitespace and capitalises each word. */
function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s.'-])([a-z])/g, (_match, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Strip any character outside the allowed name character set. */
function sanitiseNameInput(value: string): string {
  return value.replace(/[^A-Za-z\s.'-]/g, '');
}

/** Age range constants used when schema validation is missing. */
const AGE_MIN_DEFAULT = 10;
const AGE_MAX_DEFAULT = 150;
import {
  getVisibleOptions,
  applyMultiSelectRules,
  applyGroupExclusivity,
  computeGroupExclusivityDeselections,
  getExclusiveOptions,
} from '@/runtime/optionFilterEngine';
import { useAssessmentStore } from '@/stores/useAssessmentStore';

interface QuestionRendererProps {
  question: Question;
  currentAnswer: any;
  onAnswer: (answer: any) => void;
  allAnswers: Record<string, any>;
}

export function QuestionRenderer({ question, currentAnswer, onAnswer, allAnswers }: QuestionRendererProps) {
  const visibleOptions = getVisibleOptions(question, allAnswers);
  const exclusiveIds = getExclusiveOptions(question).map(o => o.id);

  // Transient hint shown when group exclusivity auto-deselects a conflicting option.
  // Driven entirely by protocol metadata (question.mutualExclusivityToast) — no option names hardcoded here.
  const [deselectedHint, setDeselectedHint] = useState<string | null>(null);
  const recordExclusivityEvent = useAssessmentStore(s => s.recordExclusivityEvent);

  // ── Field-specific validation state ────────────────────────────────────
  const isNameField = question.id === 'name' || question.uiFormat === 'name';
  const isAgeField = question.id === 'age';
  const ageMin = question.validation?.min ?? AGE_MIN_DEFAULT;
  const ageMax = question.validation?.max ?? AGE_MAX_DEFAULT;

  const [nameError, setNameError] = useState<string | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={question.id}
        initial={{ opacity: 0, x: 15 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -15 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-3">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
            {question.title}
          </h2>
          {question.subtitle && (
            <p className="text-slate-500 text-lg leading-relaxed font-medium">
              {question.subtitle}
            </p>
          )}
          {question.helperText && (
            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mt-2">
              <p className="text-blue-700 text-sm font-medium">{question.helperText}</p>
            </div>
          )}
        </div>

        {/* --- MUTUAL EXCLUSIVITY DESELECT HINT --- */}
        {/* Driven by protocol metadata — no option names hardcoded */}
        <AnimatePresence>
          {deselectedHint && (
            <motion.div
              key="exclusivity-hint"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-200 bg-violet-50/80 text-violet-700 text-sm font-medium select-none"
              role="status"
              aria-live="polite"
            >
              <span className="shrink-0 text-violet-400" aria-hidden="true">↺</span>
              {deselectedHint}
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- TEXT INPUT --- */}
        {question.type === 'text' && (
          <div className="mt-4">
            <Input
              type="text"
              placeholder={question.validation?.errorMessage ?? 'Type your answer…'}
              value={currentAnswer ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (!isNameField) {
                  onAnswer(raw);
                  return;
                }
                // Names: digits / symbols are rejected; clean input is title-cased
                if (/\d/.test(raw)) {
                  setNameError('Numbers are not allowed in a name. Use letters only.');
                } else {
                  setNameError(null);
                }
                const sanitised = sanitiseNameInput(raw);
                const cased = toTitleCase(sanitised);
                onAnswer(cased);
              }}
              onBlur={() => {
                if (isNameField && typeof currentAnswer === 'string') {
                  onAnswer(toTitleCase(sanitiseNameInput(currentAnswer)));
                }
              }}
              inputMode={isNameField ? 'text' : undefined}
              autoCapitalize={isNameField ? 'words' : undefined}
              className="h-16 text-xl px-6 rounded-2xl shadow-sm border-2 border-slate-200 focus-visible:ring-primary"
            />
            {isNameField && nameError && (
              <p className="mt-2 text-sm font-medium text-rose-600">{nameError}</p>
            )}
          </div>
        )}

        {/* --- NUMBER INPUT --- */}
        {question.type === 'number' && (
          <div className="mt-4">
            <Input
              type="number"
              placeholder={isAgeField ? `e.g. 28 (between ${ageMin} and ${ageMax})` : 'e.g. 28'}
              value={currentAnswer ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  if (isAgeField) setAgeError(null);
                  onAnswer('');
                  return;
                }
                const num = Number(raw);
                if (isAgeField) {
                  if (!Number.isFinite(num) || !Number.isInteger(num)) {
                    setAgeError('Age must be a whole number.');
                  } else if (num < ageMin || num > ageMax) {
                    setAgeError(`Age must be between ${ageMin} and ${ageMax}.`);
                  } else {
                    setAgeError(null);
                  }
                }
                onAnswer(num);
              }}
              className="h-16 text-2xl px-6 rounded-2xl shadow-sm border-2 border-slate-200 focus-visible:ring-primary"
              min={isAgeField ? ageMin : question.validation?.min}
              max={isAgeField ? ageMax : question.validation?.max}
              step={isAgeField ? 1 : undefined}
            />
            {isAgeField && ageError && (
              <p className="mt-2 text-sm font-medium text-rose-600">{ageError}</p>
            )}
          </div>
        )}

        {/* --- TEXTAREA INPUT --- */}
        {question.type === 'textarea' && (
          <div className="mt-4">
            <Textarea
              placeholder="Start typing…"
              value={currentAnswer ?? ''}
              onChange={(e) => onAnswer(e.target.value)}
              className="min-h-[150px] text-lg p-6 rounded-2xl shadow-sm border-2 border-slate-200 resize-none focus-visible:ring-primary"
            />
          </div>
        )}

        {/* --- IMAGE UPLOAD --- */}
        {question.type === 'image_upload' && (
          <div className="mt-4 border-2 border-dashed border-slate-300 rounded-3xl p-12 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
            <div className="w-20 h-20 bg-white shadow-sm rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-10 h-10 text-primary" />
            </div>
            <p className="text-xl font-bold text-slate-700 mb-2">Tap to Upload Photo</p>
            <p className="text-slate-500 text-center font-medium">Use your camera or select from gallery</p>
            <Input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  onAnswer('uploaded_file_url_mock');
                }
              }}
            />
          </div>
        )}

        {/* --- SELECTORS (SINGLE / MULTI / IMAGE) --- */}
        {(question.type === 'image_select' ||
          question.type === 'single_select' ||
          question.type === 'multi_select' ||
          question.type === 'scale') && (
          <div
            className={cn(
              'grid gap-4 mt-2',
              question.type === 'image_select'
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                : 'grid-cols-1'
            )}
          >
            {visibleOptions.map((option) => {
              const isSelected = Array.isArray(currentAnswer)
                ? currentAnswer.includes(option.id)
                : currentAnswer === option.id;

              const handleSelect = () => {
                if (question.type === 'multi_select') {
                  const arr = Array.isArray(currentAnswer) ? currentAnswer : [];
                  if (question.mutualExclusivityGroups?.length) {
                    // Detect which options will be auto-deselected before applying the rule
                    const autoDeselected = computeGroupExclusivityDeselections(
                      arr, option.id, question.mutualExclusivityGroups
                    );
                    if (autoDeselected.length > 0) {
                      // Fire store event (consumed by DebugPanel)
                      recordExclusivityEvent({
                        questionId: question.id,
                        selected: option.id,
                        deselected: autoDeselected,
                      });
                      // Show transient protocol-driven hint (label from schema, not hardcoded)
                      if (question.mutualExclusivityToast) {
                        setDeselectedHint(question.mutualExclusivityToast);
                        setTimeout(() => setDeselectedHint(null), 2500);
                      }
                    }
                    onAnswer(
                      applyGroupExclusivity(arr, option.id, question.mutualExclusivityGroups, exclusiveIds)
                    );
                  } else {
                    onAnswer(applyMultiSelectRules(arr, option.id, exclusiveIds));
                  }
                } else {
                  onAnswer(option.id);
                }
              };

              if (question.type === 'image_select') {
                return (
                  <ImageSelectCard
                    key={option.id}
                    option={option}
                    isSelected={isSelected}
                    onClick={handleSelect}
                  />
                );
              }

              // Text-based option button
              return (
                <button
                  key={option.id}
                  onClick={handleSelect}
                  className={cn(
                    'p-5 rounded-2xl border-2 text-left transition-all duration-200',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-slate-200 hover:border-primary/40 bg-white'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {option.icon && (
                      <span className="text-2xl shrink-0" aria-hidden="true">
                        {option.icon}
                      </span>
                    )}
                    <div>
                      <h4
                        className={cn(
                          'font-semibold text-lg',
                          isSelected ? 'text-primary' : 'text-slate-700'
                        )}
                      >
                        {option.label}
                      </h4>
                      {option.description && (
                        <p className="text-slate-500 text-sm mt-1 font-medium">{option.description}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
