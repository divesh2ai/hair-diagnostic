'use client';

import { cn } from '@/lib/utils';
import { Mic, MicOff } from 'lucide-react';

/**
 * VOICE INPUT BUTTON
 *
 * Microphone button for speech-to-text input.
 * Extracted from legacy toggleRecording functionality.
 *
 * Features:
 * - Visual recording state feedback
 * - Color changes (green idle, red recording)
 * - Hover states
 * - Accessibility labels
 */

interface VoiceInputButtonProps {
  /** Is recording active */
  isRecording?: boolean;

  /** Click/toggle handler */
  onClick?: () => void;

  /** Optional className */
  className?: string;

  /** Optional icon size */
  iconSize?: number;

  /** Disabled state */
  disabled?: boolean;

  /** Aria label for accessibility */
  ariaLabel?: string;
}

export function VoiceInputButton({
  isRecording = false,
  onClick,
  className,
  iconSize = 16,
  disabled = false,
  ariaLabel,
}: VoiceInputButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || (isRecording ? 'Stop recording' : 'Start recording')}
      title={isRecording ? 'Stop recording' : 'Start recording'}
      className={cn(
        // Base button styling
        'p-2 rounded-full transition-colors',
        // Recording state styling
        isRecording
          ? 'bg-red-100 text-red-500 hover:bg-red-200'
          : 'bg-[#eef4ee] text-[#2a5c3a] hover:bg-[#dce8dc]',
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {isRecording ? (
        <MicOff className="w-4 h-4" style={{ width: iconSize, height: iconSize }} />
      ) : (
        <Mic className="w-4 h-4" style={{ width: iconSize, height: iconSize }} />
      )}
    </button>
  );
}
