// ─── Avatar Engine — public API ──────────────────────────────────────────────

export type {
  AvatarProvider,
  AvatarProviderName,
  AvatarProviderInfo,
  AvatarCapabilityTier,
  AvatarSessionEvent,
  AvatarSessionListener,
  ConsultationSession,
  ConsultationSessionState,
  ConsultationSessionStatus,
  OpenSessionInput,
} from './types';

export {
  getAvatarProvider,
  registerAvatarProvider,
  listAvatarProviders,
} from './providers';

export { nullAvatarProvider } from './providers/null';
