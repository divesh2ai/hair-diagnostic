// Authoritative auth surface. Two parallel APIs live here intentionally:
//
//   • Legacy (./legacy): requireRole / requireClinicScope — return AuthClaims
//     OR a NextResponse short-circuit. Existing routes already use this shape;
//     do not migrate them in a rush.
//
//   • Tenant guard (./tenantGuard): assertRole / assertClinicAccess / ... —
//     throw UnauthorizedError | ForbiddenError; caller maps with handleAuthError.
//     Used by new platform-foundation routes.
//
// Both ultimately read from the same Supabase getClaims() — the JWT, verified
// by JWKS, is the only trusted source. SystemRole is shared.
export * from "./roles";
export * from "./clinicContext";
export * from "./tenantGuard";
export * from "./legacy";
