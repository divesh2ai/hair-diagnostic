/**
 * skinAcneProtocol.ts
 *
 * Typed re-export of the DrSkinFACT acne protocol JSON, mirroring
 * masterProtocol.ts. The schema shape is identical to the hair protocol so we
 * reuse MasterProtocol/SchemaSection/SchemaQuestion types.
 */

import rawProtocol from '../schema/skin-acne.schema.json';
import type { MasterProtocol } from './masterProtocol';

export const skinAcneProtocol: MasterProtocol = rawProtocol as MasterProtocol;

export default skinAcneProtocol;
