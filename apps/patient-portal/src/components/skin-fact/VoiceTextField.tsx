'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import styles from './voice-text-field.module.css';

type SpeechRecognitionEventLike = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function VoiceTextField({
  value,
  onChange,
  multiline = true,
  className,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    setSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    return () => recognition.current?.abort();
  }, []);

  function toggle() {
    if (listening) { recognition.current?.stop(); return; }
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) return;
    const instance = new Recognition();
    instance.continuous = false;
    instance.interimResults = false;
    instance.lang = 'en-IN';
    instance.onresult = (event) => {
      const transcript = Array.from(event.results)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(' ');
      if (transcript) onChange(`${valueRef.current}${valueRef.current.trim() ? ' ' : ''}${transcript}`);
    };
    instance.onerror = () => { setSpeechError('Voice input was not captured. You can try again or continue typing.'); setListening(false); };
    instance.onend = () => setListening(false);
    recognition.current = instance;
    setSpeechError('');
    setListening(true);
    instance.start();
  }

  return <div className={styles.wrap}>
    {multiline
      ? <textarea className={className} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={ariaLabel}/>
      : <input className={className} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={ariaLabel}/>}
    <button type="button" className={`${styles.mic} ${listening ? styles.listening : ''}`} onClick={toggle} disabled={!supported} aria-label={!supported ? 'Voice input is unavailable in this browser' : listening ? 'Stop voice input' : 'Answer using microphone'} title={!supported ? 'Voice input is unavailable in this browser' : listening ? 'Stop listening' : 'Answer using microphone'}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button>
    {listening&&<span className={styles.status} role="status">Listening…</span>}
    {speechError&&<small className={styles.error}>{speechError}</small>}
  </div>;
}
