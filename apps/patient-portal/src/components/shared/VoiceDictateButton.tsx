'use client';

import { useEffect, useRef, useState } from 'react';
import { VoiceInputButton } from './VoiceInputButton';

interface VoiceDictateButtonProps {
  /** Current text value — recognised speech is appended to this. */
  value: string;
  /** Called with the updated full text after each recognition result. */
  onChange: (next: string) => void;
  /** BCP-47 language tag. Defaults to 'en-US'. */
  lang?: string;
  className?: string;
  iconSize?: number;
}

function getSpeechRecognitionCtor(): any | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

/**
 * Microphone button that dictates the patient's speech into the linked
 * text input. Uses the Web Speech API; silently hidden on browsers that
 * don't expose it (Firefox desktop, some embedded webviews).
 */
export function VoiceDictateButton({
  value,
  onChange,
  lang = 'en-US',
  className,
  iconSize,
}: VoiceDictateButtonProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseValueRef = useRef<string>('');

  useEffect(() => {
    setSupported(!!getSpeechRecognitionCtor());
    return () => {
      try { recognitionRef.current?.stop(); } catch {}
    };
  }, []);

  const start = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    baseValueRef.current = value ? value.replace(/\s+$/, '') + ' ' : '';

    rec.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText) {
        baseValueRef.current = (baseValueRef.current + finalText).replace(/\s+/g, ' ').replace(/^\s+/, '');
      }
      const combined = (baseValueRef.current + interimText).replace(/\s+/g, ' ').replace(/^\s+/, '');
      onChange(combined);
    };

    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    try {
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stop = () => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  };

  if (!supported) return null;

  return (
    <VoiceInputButton
      isRecording={listening}
      onClick={listening ? stop : start}
      className={className}
      iconSize={iconSize}
    />
  );
}
