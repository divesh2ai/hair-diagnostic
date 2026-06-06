'use client';

import { motion } from 'framer-motion';
import { QuestionOption } from '@/types/questionnaire';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

interface ImageSelectCardProps {
  option: QuestionOption;
  isSelected: boolean;
  onClick: () => void;
}

export function ImageSelectCard({ option, isSelected, onClick }: ImageSelectCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative flex flex-col cursor-pointer rounded-2xl overflow-hidden border-2 transition-all duration-200",
        isSelected 
          ? "border-primary bg-primary/5 shadow-md" 
          : "border-border hover:border-primary/50 bg-card"
      )}
    >
      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 z-10 text-primary bg-white rounded-full shadow-sm">
          <CheckCircle2 className="w-7 h-7" />
        </div>
      )}

      {/* Large Image Area */}
      {option.image && (
        <div className="aspect-square bg-muted relative overflow-hidden">
          <img 
            src={option.image.url} 
            alt={option.image.alt}
            className="object-cover w-full h-full"
          />
        </div>
      )}

      {/* Text Area */}
      <div className="p-4 flex flex-col gap-1 flex-1 bg-card">
        <h4 className="font-semibold text-lg leading-tight text-foreground">{option.label}</h4>
        {option.description && (
          <p className="text-sm text-muted-foreground leading-snug">{option.description}</p>
        )}
      </div>
    </motion.div>
  );
}
