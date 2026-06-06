/**
 * mapKitToTopicals
 *
 * Resolves a kit's topical components into full TopicalKnowledge entries.
 */

import type { KitId, TopicalKnowledge } from '../types';
import { getKitKnowledge } from '../retrievers/getKitKnowledge';
import { getTopicalKnowledge } from '../retrievers/getTopicalKnowledge';

export interface KitTopicalMap {
  readonly kitId: KitId;
  readonly resolved: readonly TopicalKnowledge[];
  readonly unresolvedIds: readonly string[];
}

export function mapKitToTopicals(kitId: KitId): KitTopicalMap {
  const kitResult = getKitKnowledge(kitId);

  if (!kitResult.found || kitResult.data === null) {
    return { kitId, resolved: [], unresolvedIds: [] };
  }

  const topicalComponents = kitResult.data.components.filter(
    (c) => c.type === 'TOPICAL'
  );

  const resolved: TopicalKnowledge[] = [];
  const unresolvedIds: string[] = [];

  for (const component of topicalComponents) {
    const result = getTopicalKnowledge(component.productId);
    if (result.found && result.data !== null) {
      resolved.push(result.data);
    } else {
      unresolvedIds.push(component.productId);
    }
  }

  return { kitId, resolved, unresolvedIds };
}
