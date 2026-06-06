// ─── Bullet List Formatters ───────────────────────────────────────────────────

export function formatMarkdownBullets(items: readonly string[]): string {
  return items.map(i => `- ${i}`).join('\n');
}

export function formatNumberedList(items: readonly string[]): string {
  return items.map((i, idx) => `${idx + 1}. ${i}`).join('\n');
}

export function formatBoldBullets(
  items: readonly { label: string; body: string }[]
): string {
  return items.map(i => `- **${i.label}**: ${i.body}`).join('\n');
}

export function formatChecklistBullets(items: readonly string[]): string {
  return items.map(i => `☐ ${i}`).join('\n');
}

export function formatWhatsAppBullets(items: readonly string[]): string {
  return items.map(i => `• ${i}`).join('\n');
}

export function formatSectionBlock(
  title: string,
  bullets: readonly string[],
  style: 'markdown' | 'whatsapp' | 'numbered' = 'markdown'
): string {
  const header = `**${title}**\n`;
  const body =
    style === 'numbered'
      ? formatNumberedList(bullets)
      : style === 'whatsapp'
      ? formatWhatsAppBullets(bullets)
      : formatMarkdownBullets(bullets);
  return header + body;
}

export function truncateBullets(
  items: readonly string[],
  maxItems: number,
  maxCharsPerItem: number
): readonly string[] {
  return items.slice(0, maxItems).map(i =>
    i.length > maxCharsPerItem ? i.slice(0, maxCharsPerItem - 3) + '...' : i
  );
}
