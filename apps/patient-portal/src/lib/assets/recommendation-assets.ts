// ────────────────────────────────────────────────────────────────────────────
// Recommendation asset registry — single source of truth.
//
// Phase 1: curated Unsplash CDN URLs (hotlinking is permitted under Unsplash
// licence). Phase 2 (NOT NOW): swap `buildSrc` to point at local
// `/public/assets/recommendations/<slug>.jpg`. Rendering code never needs
// to change.
//
// Contract:
//   getRecommendationAsset(name) → { src?, emoji? }
//   - src present  → tile renders an image (with onError fallback to emoji)
//   - src absent   → tile renders the emoji
//   - both absent  → tile renders a neutral placeholder
// Lookup is deterministic: first matching rule wins, rules ordered specific→generic.
// No runtime API calls. No async. No loading states.
// ────────────────────────────────────────────────────────────────────────────

export type AssetCategory =
  | "protein"
  | "fruit"
  | "vegetable"
  | "grain"
  | "seed"
  | "nut"
  | "dairy"
  | "supplement"
  | "hydration"
  | "sleep"
  | "exercise"
  | "stress"
  | "haircare"
  | "habit"
  | "avoid";

export type AssetLookup = {
  src?: string;
  emoji?: string;
};

// Phase 2 swap point — replace this implementation to load from
// /public/assets/recommendations/<slug>.jpg without touching the rules below.
const buildSrc = (unsplashPhotoId: string): string =>
  `https://images.unsplash.com/${unsplashPhotoId}?w=400&h=400&fit=crop&auto=format&q=70`;

type Rule = {
  match: RegExp;
  /** Unsplash photo id, e.g. "photo-1576045057995-568f588f82fb". */
  photoId?: string;
  emoji: string;
  category: AssetCategory;
};

// Order matters: most specific match wins.
const RULES: Rule[] = [
  // ── Vegetables ───────────────────────────────────────────────────────
  { match: /spinach|kale|leafy|leafy green/i,           photoId: "photo-1576045057995-568f588f82fb", emoji: "🥬", category: "vegetable" },
  { match: /broccoli|cauliflower/i,                      photoId: "photo-1584270354949-c26b0d5b4a0c", emoji: "🥦", category: "vegetable" },
  { match: /tomato/i,                                    photoId: "photo-1592924357228-91a4daadcfea", emoji: "🍅", category: "vegetable" },
  { match: /carrot/i,                                    photoId: "photo-1582515073490-39981397c445", emoji: "🥕", category: "vegetable" },
  { match: /sweet potato/i,                              photoId: "photo-1730815048561-45df6f7f331d", emoji: "🍠", category: "vegetable" },
  { match: /potato/i,                                    photoId: "photo-1518977676601-b53f82aba655", emoji: "🥔", category: "vegetable" },
  { match: /beet|beetroot/i,                             photoId: "photo-1593105544559-ecb03bf76f82", emoji: "🥗", category: "vegetable" },
  { match: /bell pepper|capsicum|pepper/i,               photoId: "photo-1563565375-f3fdfdbefa83", emoji: "🫑", category: "vegetable" },

  // ── Fruit ────────────────────────────────────────────────────────────
  { match: /berry|blueberry|raspberry|strawberry/i,      photoId: "photo-1498557850523-fd3d118b962e", emoji: "🫐", category: "fruit" },
  { match: /orange|citrus/i,                             photoId: "photo-1547514701-42782101795e", emoji: "🍊", category: "fruit" },
  { match: /lemon|lime/i,                                photoId: "photo-1590502593747-42a996133562", emoji: "🍋", category: "fruit" },
  { match: /apple/i,                                     photoId: "photo-1568702846914-96b305d2aaeb", emoji: "🍎", category: "fruit" },
  { match: /banana/i,                                    photoId: "photo-1571771894821-ce9b6c11b08e", emoji: "🍌", category: "fruit" },
  { match: /avocado/i,                                   photoId: "photo-1523049673857-eb18f1d7b578", emoji: "🥑", category: "fruit" },
  { match: /pomegranate/i,                               photoId: "photo-1615485290382-441e4d049cb5", emoji: "🍎", category: "fruit" },
  { match: /papaya|mango/i,                              photoId: "photo-1553279768-865429fa0078", emoji: "🥭", category: "fruit" },

  // ── Protein ──────────────────────────────────────────────────────────
  { match: /egg/i,                                       photoId: "photo-1582722872445-44dc5f7e3c8f", emoji: "🥚", category: "protein" },
  { match: /salmon/i,                                    photoId: "photo-1467003909585-2f8a72700288", emoji: "🐟", category: "protein" },
  { match: /tuna|sardine|mackerel/i,                     photoId: "photo-1590769383363-5681e57ff10f", emoji: "🐟", category: "protein" },
  { match: /fish|seafood|prawn|shrimp/i,                 photoId: "photo-1559847844-5315695dadae", emoji: "🐟", category: "protein" },
  { match: /chicken|poultry|turkey/i,                    photoId: "photo-1587593810167-a84920ea0781", emoji: "🍗", category: "protein" },
  { match: /lentil|dal|chickpea|legume|rajma|bean/i,     photoId: "photo-1515543237350-b3eea1ec8082", emoji: "🫘", category: "protein" },
  { match: /tofu|paneer|soy/i,                           photoId: "photo-1583511655826-05700d52f4d9", emoji: "🧀", category: "protein" },
  { match: /protein/i,                                   photoId: "photo-1490645935967-10de6ba17061", emoji: "💪", category: "protein" },

  // ── Dairy ────────────────────────────────────────────────────────────
  { match: /yogurt|curd|greek yogurt/i,                  photoId: "photo-1488477181946-6428a0291777", emoji: "🥛", category: "dairy" },
  { match: /milk/i,                                      photoId: "photo-1550583724-b2692b85b150", emoji: "🥛", category: "dairy" },

  // ── Nuts & Seeds ─────────────────────────────────────────────────────
  { match: /almond|walnut|cashew|pistachio|nut/i,        photoId: "photo-1508061253366-f7da158b6d46", emoji: "🥜", category: "nut" },
  { match: /flax|chia|pumpkin seed|sesame|seed/i,        photoId: "photo-1574323347407-f5e1ad6d020b", emoji: "🌱", category: "seed" },

  // ── Grains ───────────────────────────────────────────────────────────
  { match: /oat|oatmeal|porridge/i,                      photoId: "photo-1517673400267-0251440c45dc", emoji: "🌾", category: "grain" },
  { match: /quinoa|millet/i,                             photoId: "photo-1586201375761-83865001e31c", emoji: "🌾", category: "grain" },
  { match: /brown rice|whole grain|whole.?wheat/i,       photoId: "photo-1586201375761-83865001e31c", emoji: "🌾", category: "grain" },

  // ── Hydration ────────────────────────────────────────────────────────
  { match: /water|hydrate|hydration/i,                   photoId: "photo-1548839140-29a749e1cf4d", emoji: "💧", category: "hydration" },
  { match: /coconut water/i,                             photoId: "photo-1551024709-8f23befc6f87", emoji: "🥥", category: "hydration" },
  { match: /green tea|herbal tea/i,                      photoId: "photo-1576092768241-dec231879fc3", emoji: "🍵", category: "hydration" },
  { match: /\btea\b/i,                                   photoId: "photo-1576092768241-dec231879fc3", emoji: "🍵", category: "hydration" },

  // ── Lifestyle / habits (HELPS) ───────────────────────────────────────
  { match: /sleep|rest|7.?8 hours/i,                     photoId: "photo-1564019472231-4586c552dc27", emoji: "😴", category: "sleep" },
  { match: /exercise|workout|walk|run|cardio|movement/i, photoId: "photo-1571019613454-1cb2f99b2d8b", emoji: "🏃", category: "exercise" },
  { match: /yoga|meditation|mindful|breath/i,            photoId: "photo-1545205597-3d9d02c29597", emoji: "🧘", category: "stress" },
  { match: /sun|vitamin d|sunlight/i,                    photoId: "photo-1517483000871-1dbf64a6e1c6", emoji: "☀️", category: "habit" },
  { match: /scalp massage|scalp care|gentle routine/i,   photoId: "photo-1522337360788-8b13dee7a37e", emoji: "💆", category: "haircare" },
  { match: /shampoo|conditioner|hair wash/i,             photoId: "photo-1522338242992-e1a54906a8da", emoji: "🧴", category: "haircare" },

  // ── Supplements ──────────────────────────────────────────────────────
  { match: /iron/i,                                      photoId: "photo-1607619056574-7b8d3ee536b2", emoji: "🩸", category: "supplement" },
  { match: /biotin|vitamin b/i,                          photoId: "photo-1607619056574-7b8d3ee536b2", emoji: "💊", category: "supplement" },
  { match: /vitamin c|ascorbic/i,                        photoId: "photo-1584308666744-24d5c474f2ae", emoji: "🍊", category: "supplement" },
  { match: /omega|fish oil/i,                            photoId: "photo-1556909114-f6e7ad7d3136", emoji: "💊", category: "supplement" },
  { match: /supplement|multivitamin/i,                   photoId: "photo-1584308666744-24d5c474f2ae", emoji: "💊", category: "supplement" },

  // ── Avoidance (HURTS) ────────────────────────────────────────────────
  { match: /smok|tobacco|cigarette/i,                    photoId: "photo-1554415707-6e8cfc93fe23", emoji: "🚭", category: "avoid" },
  { match: /alcohol|alcoholic|wine|beer|liquor|spirits|vodka|whiskey|whisky|rum|cocktail|booze/i, photoId: "photo-1568213816046-0ee1c42bd559", emoji: "🍷", category: "avoid" },
  { match: /sugar|sweet|dessert|candy/i,                 photoId: "photo-1488477181946-6428a0291777", emoji: "🍬", category: "avoid" },
  { match: /soda|cola|soft drink|fizzy|sugary drink/i,   photoId: "photo-1554866585-cd94860890b7", emoji: "🥤", category: "avoid" },
  { match: /fried|fast food|junk|chips|crisp/i,          photoId: "photo-1606755962773-d324e0a13086", emoji: "🍟", category: "avoid" },
  { match: /pizza|burger/i,                              photoId: "photo-1568901346375-23c9450c58cd", emoji: "🍔", category: "avoid" },
  { match: /processed|packaged|refined/i,                photoId: "photo-1606755962773-d324e0a13086", emoji: "🥫", category: "avoid" },
  { match: /red meat|bacon|sausage|salami|deli/i,        photoId: "photo-1602470521006-561330d68e9c", emoji: "🥓", category: "avoid" },
  { match: /caffeine|coffee/i,                           photoId: "photo-1509042239860-f550ce710b93", emoji: "☕", category: "avoid" },
  { match: /spicy|chilli|chili/i,                        photoId: "photo-1583119022894-919a68a3d0e3", emoji: "🌶️", category: "avoid" },
  { match: /salt|sodium|pickle/i,                        photoId: "photo-1650072395437-223b4906207d", emoji: "🧂", category: "avoid" },
  { match: /heat styl|straighten|blow.?dry|hair iron/i,  photoId: "photo-1559599101-f09722fb4948", emoji: "🔥", category: "avoid" },
  { match: /pollution|chemical|dye|bleach/i,             photoId: "photo-1578604665675-9aee692f6ddc", emoji: "🧪", category: "avoid" },
  { match: /sedentary|inactive/i,                        photoId: "photo-1530021232320-687d8e3dba54", emoji: "🛋️", category: "avoid" },
  { match: /crash diet|fasting|skipping meal|low.calorie/i, photoId: "photo-1606755962773-d324e0a13086", emoji: "🍽️", category: "avoid" },
  { match: /thyroid|hormonal|pcos|menopause/i,           photoId: "photo-1559757175-5700dde675bc", emoji: "⚖️", category: "avoid" },
  { match: /iron deficiency|anaemia|anemia/i,            photoId: "photo-1559757175-5700dde675bc", emoji: "🩸", category: "avoid" },
  { match: /inflammation|inflammatory/i,                 photoId: "photo-1559757175-5700dde675bc", emoji: "🔥", category: "avoid" },
  { match: /dandruff|seborr/i,                           photoId: "photo-1522338140262-f46f5913618a", emoji: "❄️", category: "avoid" },
  { match: /stress|anxiety|cortisol/i,                   photoId: "photo-1499209974431-9dddcece7f88", emoji: "😰", category: "avoid" },
  { match: /poor sleep|sleep deprivation|insomnia|late night|night shift/i, photoId: "photo-1552858725-2758b5fb1286", emoji: "🌙", category: "avoid" },
  { match: /frequent fly|travel/i,                       photoId: "photo-1436491865332-7a61a109cc05", emoji: "✈️", category: "avoid" },
];

/** Deterministic lookup. First matching rule wins. */
export function getRecommendationAsset(name: string): AssetLookup {
  if (!name || typeof name !== "string") return {};
  for (const rule of RULES) {
    if (rule.match.test(name)) {
      return {
        src: rule.photoId ? buildSrc(rule.photoId) : undefined,
        emoji: rule.emoji,
      };
    }
  }
  return {};
}
