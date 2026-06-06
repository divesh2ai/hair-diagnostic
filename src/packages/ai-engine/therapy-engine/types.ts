import type { TherapyNeed } from '../../types';

export type { TherapyNeed };

export interface TherapyNeeds {
  readonly needs: readonly TherapyNeed[];
  readonly needReasons: Partial<Record<TherapyNeed, string[]>>;
}
