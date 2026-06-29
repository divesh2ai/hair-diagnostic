import type { AvatarProvider, AvatarProviderName } from '../types';
import { nullAvatarProvider } from './null';

// ─── Provider registry ────────────────────────────────────────────────────────
//
// Lookup table for avatar providers. Today only the null (text-only) provider
// is registered. Real providers (prerendered video adapter, realtime avatar
// runtimes) register themselves here as they land.
//
// Selection is by name with an env-driven default — AVATAR_PROVIDER env var
// chooses the runtime per deployment. Falls back to 'null' if unset/unknown.
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRY: Partial<Record<AvatarProviderName, AvatarProvider>> = {
  null: nullAvatarProvider,
};

export function registerAvatarProvider(provider: AvatarProvider): void {
  REGISTRY[provider.info.name] = provider;
}

export function getAvatarProvider(name?: AvatarProviderName): AvatarProvider {
  const requested = name ?? (process.env.AVATAR_PROVIDER as AvatarProviderName | undefined);
  if (requested && REGISTRY[requested]) {
    return REGISTRY[requested]!;
  }
  return nullAvatarProvider;
}

export function listAvatarProviders(): readonly AvatarProvider[] {
  return Object.values(REGISTRY).filter((p): p is AvatarProvider => Boolean(p));
}
