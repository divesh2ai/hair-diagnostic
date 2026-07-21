'use client';

/* eslint-disable @next/next/no-img-element -- Option media renders protocol-supplied image URLs at intrinsic size; next/image is unnecessary for these small inline thumbnails. */

import { Check } from 'lucide-react';

import type { QuestionOption } from '@/types/questionnaire';

import styles from './assessment-v3.module.css';

interface OptionCardV3Props {
  option: QuestionOption;
  isSelected: boolean;
  multi: boolean;
  density?: 'tile' | 'card' | 'feature';
  onSelect: () => void;
}

export function OptionCardV3({
  option,
  isSelected,
  multi,
  density = 'card',
  onSelect,
}: OptionCardV3Props) {
  const hasImage = Boolean(option.image?.url);
  const hasIllustration = !hasImage && Boolean(option.illustration?.url);

  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={isSelected}
      onClick={onSelect}
      className={`${styles.optionCard} ${styles[`optionCard_${density}`]} ${
        isSelected ? styles.optionCardSelected : ''
      }`}
    >
      {hasImage && (
        <span className={styles.optionMedia}>
          <img src={option.image!.url} alt={option.image!.alt} loading="lazy" />
        </span>
      )}
      {hasIllustration && (
        <span className={`${styles.optionMedia} ${styles.optionIllustration}`}>
          <img src={option.illustration!.url} alt={option.illustration!.alt} loading="lazy" />
        </span>
      )}
      <span className={styles.optionBody}>
        <strong>{option.label}</strong>
        {option.description && density !== 'tile' && <small>{option.description}</small>}
      </span>
      <span className={`${styles.selectionIndicator} ${multi ? styles.checkboxIndicator : ''}`} aria-hidden="true">
        {multi && isSelected ? <Check size={14} strokeWidth={3} /> : null}
      </span>
    </button>
  );
}
