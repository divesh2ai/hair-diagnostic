import { VisualAsset } from './types';

// This acts as the mock database for our cinematic asset catalog.
// In a full production environment, these assets live on a CDN (e.g., Supabase Storage or AWS S3)
// and their metadata lives in PostgreSQL.
export const VISUAL_ASSETS: VisualAsset[] = [
  // ==========================================
  // HAIR CYCLE (BIOLOGICAL RENDERS)
  // ==========================================
  {
    id: 'cinematic-telogen-shift',
    category: 'hair_cycle',
    conditionTags: ['telogen_effluvium', 'shedding', 'stress_hair_loss'],
    severity: 'SEVERE',
    gender: 'universal',
    imageUrl: 'https://cdn.drfact.com/assets/cinematic/biology/telogen-shift-severe.webp',
    defaultCaption: 'The Shedding Phase (Telogen Exogen)',
    defaultExplanation: 'Severe stress, fever, or trauma forces up to 30% of your follicles into an early resting phase, causing synchronized hair fall. This is a biological reset, not permanent death.'
  },
  {
    id: 'cinematic-anagen-activation',
    category: 'regrowth',
    conditionTags: ['recovery_phase', 'treatment_timeline'],
    gender: 'universal',
    imageUrl: 'https://cdn.drfact.com/assets/cinematic/biology/anagen-activation.webp',
    defaultCaption: 'Reactivating the Growth Phase (Anagen)',
    defaultExplanation: 'Through targeted cellular nutrition and topical stimulation, dormant stem cells in the hair bulge are awakened, pushing a new, thicker hair shaft to the surface.'
  },
  
  // ==========================================
  // SCALP HEALTH
  // ==========================================
  {
    id: 'cinematic-scalp-inflammation',
    category: 'scalp',
    conditionTags: ['inflammation', 'dandruff'],
    severity: 'HIGH',
    gender: 'universal',
    imageUrl: 'https://cdn.drfact.com/assets/cinematic/scalp/follicle-inflammation.webp',
    defaultCaption: 'Perifollicular Micro-Inflammation',
    defaultExplanation: 'Hidden inflammation around the hair root acts like a vice, restricting vital blood supply and oxygen. This weakens the hair shaft long before it even emerges from the scalp.'
  },
  {
    id: 'cinematic-sebum-blockage',
    category: 'scalp',
    conditionTags: ['oily_dandruff', 'scalp_buildup'],
    gender: 'universal',
    imageUrl: 'https://cdn.drfact.com/assets/cinematic/scalp/sebum-blockage.webp',
    defaultCaption: 'Sebum Oxidization & Blockage',
    defaultExplanation: 'Overactive sebaceous glands mix with dead skin cells to create a waxy plug. This blocks the follicle opening, preventing healthy growth and creating a breeding ground for yeast.'
  },

  // ==========================================
  // NUTRITION & METABOLISM
  // ==========================================
  {
    id: 'cinematic-iron-ferritin',
    category: 'nutrition',
    conditionTags: ['iron_deficiency', 'anemia', 'diffuse_shedding'],
    gender: 'female',
    imageUrl: 'https://cdn.drfact.com/assets/cinematic/nutrition/iron-ferritin-follicle.webp',
    defaultCaption: 'Ferritin & Oxygen Delivery',
    defaultExplanation: 'The hair bulb is one of the most rapidly dividing cellular structures in your body. Low ferritin (stored iron) drastically cuts its oxygen supply, forcing the body to shut down hair growth to save energy.'
  },
  
  // ==========================================
  // HORMONAL
  // ==========================================
  {
    id: 'cinematic-dht-miniaturization',
    category: 'hormonal',
    conditionTags: ['androgenetic', 'pcos', 'thinning'],
    gender: 'universal',
    imageUrl: 'https://cdn.drfact.com/assets/cinematic/biology/dht-miniaturization.webp',
    defaultCaption: 'Progressive Follicle Miniaturization',
    defaultExplanation: 'Genetic sensitivity to androgens like DHT causes the follicle to shrink with each life cycle. Hairs become progressively finer and weaker until the follicle goes completely dormant.'
  },
  
  // ==========================================
  // STRESS & CORTISOL
  // ==========================================
  {
    id: 'cinematic-cortisol-spike',
    category: 'stress',
    conditionTags: ['stress', 'cortisol', 'high_stress'],
    severity: 'HIGH',
    gender: 'universal',
    imageUrl: 'https://cdn.drfact.com/assets/cinematic/biology/cortisol-impact.webp',
    defaultCaption: 'The Cortisol Impact',
    defaultExplanation: 'Chronic stress floods the bloodstream with cortisol. This attacks the proteoglycans holding the hair in place, degrading the follicle matrix and accelerating shedding.'
  }
];
