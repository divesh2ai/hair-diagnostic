// Diet & lifestyle Unsplash asset matcher for the PDF dossier.
// Mirrors apps/patient-portal/src/lib/assets/recommendation-assets.ts but
// kept locally so the pdf-engine package does not depend on the app.
//
// Phase 1: curated Unsplash CDN URLs (hotlinking permitted under Unsplash licence).
// Phase 2: swap buildSrc to point at /public/assets/recommendations/<slug>.jpg.

const buildSrc = (photoId: string): string =>
  `https://images.unsplash.com/${photoId}?w=320&h=320&fit=crop&auto=format&q=70`;

type Rule = { match: RegExp; photoId: string };

// Order matters — most specific first.
const RULES: Rule[] = [
  // ── Foods to avoid ───────────────────────────────────────────────────
  { match: /smok|tobacco|cigarette/i,                            photoId: "photo-1554415707-6e8cfc93fe23" },
  { match: /alcohol|beer|wine|liquor|spirit|whisk|vodka|rum/i,   photoId: "photo-1568213816046-0ee1c42bd559" },
  { match: /coffee|caffeine/i,                                   photoId: "photo-1509042239860-f550ce710b93" },
  { match: /\btea\b/i,                                           photoId: "photo-1576092768241-dec231879fc3" },
  { match: /cola|coke|pepsi|soda|soft drink|fizzy/i,             photoId: "photo-1554866585-cd94860890b7" },
  { match: /pizza|burger/i,                                      photoId: "photo-1568901346375-23c9450c58cd" },
  { match: /chips|fries|tortilla|nacho|dorito|crisp/i,           photoId: "photo-1606755962773-d324e0a13086" },
  { match: /biscuit|cookie|croissant|doughnut|donut|white bread|bakery|puff/i, photoId: "photo-1568051243851-f9b136146e97" },
  { match: /chocolate|pastry|cake|ice.?cream|dessert|candy|sugar/i, photoId: "photo-1488477181946-6428a0291777" },
  { match: /pasta|cream|melted cheese/i,                         photoId: "photo-1551892589-865f69869476" },
  { match: /potato/i,                                            photoId: "photo-1518977676601-b53f82aba655" },
  { match: /chicken|poultry|turkey/i,                            photoId: "photo-1587593810167-a84920ea0781" },
  { match: /beef|pork|lamb|red meat|bacon|sausage/i,             photoId: "photo-1602470521006-561330d68e9c" },
  { match: /fish|seafood|salmon|tuna|prawn|shrimp|sardine/i,     photoId: "photo-1559847844-5315695dadae" },
  { match: /\begg/i,                                             photoId: "photo-1582722872445-44dc5f7e3c8f" },
  { match: /processed|canned|fast food|junk|ajinomoto|chinese/i, photoId: "photo-1606755962773-d324e0a13086" },
  { match: /heat styl|straighten|blow.?dry|hair iron|chemical|dye|bleach/i, photoId: "photo-1559599101-f09722fb4948" },

  // ── Foods to add ─────────────────────────────────────────────────────
  { match: /sprout/i,                                            photoId: "photo-1574323347407-f5e1ad6d020b" },
  { match: /leafy|spinach|kale|greens/i,                         photoId: "photo-1576045057995-568f588f82fb" },
  { match: /salad|beetroot|cucumber|carrot|tomato/i,             photoId: "photo-1512621776951-a57141f2eefd" },
  { match: /bean|chickpea|lentil|rajma|legume|dal/i,             photoId: "photo-1515543237350-b3eea1ec8082" },
  { match: /tofu|paneer|cottage cheese|mushroom/i,               photoId: "photo-1583511655826-05700d52f4d9" },
  { match: /walnut|almond|cashew|nut|flax|pumpkin seed|seed/i,   photoId: "photo-1508061253366-f7da158b6d46" },
  { match: /dairy|cheese|olive.?oil/i,                           photoId: "photo-1488477181946-6428a0291777" },
  { match: /fruit|apple|banana|berry|orange|papaya|mango/i,      photoId: "photo-1568702846914-96b305d2aaeb" },
  { match: /green tea|herbal tea/i,                              photoId: "photo-1576092768241-dec231879fc3" },
  { match: /water|hydrate|litre/i,                               photoId: "photo-1548839140-29a749e1cf4d" },
  { match: /balanced diet|whey protein/i,                        photoId: "photo-1490645935967-10de6ba17061" },

  // ── Lifestyle ────────────────────────────────────────────────────────
  { match: /sleep|wake window|7\+ hours/i,                       photoId: "photo-1564019472231-4586c552dc27" },
  { match: /daylight|morning sun|sunlight|vitamin d/i,           photoId: "photo-1517483000871-1dbf64a6e1c6" },
  { match: /walk|exercise|workout|cardio|run|brisk/i,            photoId: "photo-1571019613454-1cb2f99b2d8b" },
  { match: /breath|meditat|mindful|yoga|cortisol/i,              photoId: "photo-1545205597-3d9d02c29597" },
  { match: /screen|phone|melatonin|no.?screen/i,                 photoId: "photo-1552858725-2758b5fb1286" },
  { match: /scalp massage|scalp care/i,                          photoId: "photo-1522337360788-8b13dee7a37e" },
  { match: /shampoo|conditioner|hair wash/i,                     photoId: "photo-1522338242992-e1a54906a8da" },
  { match: /stress|anxiety|relax/i,                              photoId: "photo-1499209974431-9dddcece7f88" },
];

const FALLBACK = "photo-1490645935967-10de6ba17061"; // neutral plate

export function dietImageFor(text: string): string {
  if (!text) return buildSrc(FALLBACK);
  for (const r of RULES) {
    if (r.match.test(text)) return buildSrc(r.photoId);
  }
  return buildSrc(FALLBACK);
}
