export function mapProduct(condition: string) {
  const c = condition.toLowerCase();
  if (c.includes('telogen')) return { title: 'Hair Fact TE Gold Kit', id: 'hf-te-gold', link: 'https://example.com/products/hf-te-gold' };
  if (c.includes('androgen') || c.includes('androgenetic')) return { title: 'DHT Shield Kit', id: 'dht-shield', link: 'https://example.com/products/dht-shield' };
  if (c.includes('alopecia') && !c.includes('areata')) return { title: 'Thickening Serum Pro', id: 'thick-serum', link: 'https://example.com/products/thick-serum' };
  // default
  return { title: 'Hair Health Starter Kit', id: 'starter-kit', link: 'https://example.com/products/starter-kit' };
}
