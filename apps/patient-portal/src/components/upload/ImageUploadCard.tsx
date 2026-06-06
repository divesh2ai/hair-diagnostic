'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Camera, Check, X } from 'lucide-react';

/**
 * IMAGE UPLOAD CARD
 *
 * Drag-and-drop enabled image upload interface.
 * Extracted from legacy "extra" step with clinical photo capture.
 *
 * Features:
 * - Visual drag-over state feedback
 * - Icon changes on successful upload
 * - Optional image preview
 * - Remove button
 * - Accessible file input
 */

interface ImageUploadCardProps {
  /** Whether drag is active (for visual feedback) */
  isDragging?: boolean;

  /** Whether image is uploaded/selected */
  hasImage?: boolean;

  /** Callback when file input changes */
  onFileChange?: (file: File | null) => void;

  /** Drag over handler */
  onDragOver?: (e: React.DragEvent) => void;

  /** Drag leave handler */
  onDragLeave?: (e: React.DragEvent) => void;

  /** Drop handler */
  onDrop?: (e: React.DragEvent) => void;

  /** Remove/clear button callback */
  onRemove?: () => void;

  /** Title text */
  title?: string;

  /** Subtitle text */
  subtitle?: string;

  /** Accept file types */
  accept?: string;

  /** Optional className */
  className?: string;

  /** Show remove button (default: true) */
  showRemoveButton?: boolean;

  /** Additional buttons/content */
  actions?: ReactNode;
}

export function ImageUploadCard({
  isDragging = false,
  hasImage = false,
  onFileChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
  title = hasImage ? 'Scalp Photo Received' : 'Upload Scalp Photo',
  subtitle = hasImage
    ? 'Dr. FACT will analyze this for inflammation.'
    : 'Drag and drop or click to upload.',
  accept = 'image/*',
  className,
  showRemoveButton = true,
  actions,
}: ImageUploadCardProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        // Base styling
        'p-5 border-2 border-dashed rounded-2xl',
        // Flex layout
        'flex flex-col items-center justify-center gap-3',
        // Responsive spacing
        'transition-all',
        // Drag state colors
        isDragging
          ? 'border-[#2a5c3a] bg-[#f7fbf7] scale-[1.01]'
          : hasImage
            ? 'border-[#2a5c3a] bg-[#f7fbf7]/30'
            : 'border-[#ddd8cc] bg-white',
        className
      )}
    >
      {/* Icon Circle */}
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          hasImage
            ? 'bg-[#2a5c3a] text-white'
            : 'bg-[#eef4ee] text-[#2a5c3a]'
        )}
      >
        {hasImage ? (
          <Check className="w-5 h-5" />
        ) : (
          <Camera className="w-5 h-5" />
        )}
      </div>

      {/* Text Content */}
      <div className="text-center">
        <div className="text-xs font-bold font-sans">{title}</div>
        <p className="text-[9px] text-[#aaa] font-sans max-w-[220px] mt-1.5">
          {subtitle}
        </p>
      </div>

      {/* File Input (Hidden) */}
      <input
        type="file"
        id="image-upload"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          onFileChange?.(file || null);
        }}
      />

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap justify-center">
        {/* Select/Change Button */}
        <button
          type="button"
          onClick={() => document.getElementById('image-upload')?.click()}
          className={cn(
            'px-4 py-1.5 rounded-xl text-[9px] font-bold font-sans',
            'uppercase tracking-wider',
            'transition-all',
            'bg-[#2a5c3a] text-white',
            'shadow-md shadow-[#2a5c3a]/10',
            'hover:shadow-lg hover:shadow-[#2a5c3a]/20'
          )}
        >
          {hasImage ? 'Change Photo' : 'Select Image'}
        </button>

        {/* Remove Button */}
        {hasImage && showRemoveButton && (
          <button
            type="button"
            onClick={onRemove}
            className={cn(
              'px-3 py-1.5 rounded-xl text-[9px] font-bold font-sans',
              'uppercase tracking-wider',
              'bg-white border border-[#ddd8cc] text-[#ff4444]',
              'transition-all',
              'hover:bg-red-50'
            )}
          >
            Remove
          </button>
        )}

        {/* Custom actions */}
        {actions}
      </div>
    </div>
  );
}
