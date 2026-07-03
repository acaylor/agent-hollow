/**
 * Re-eksport rejestru providerów z shared (bliźniak theme/mapping.ts i theme/models.ts).
 * Trzyma importy klienta przy jednej ścieżce '../theme/providers'.
 */
export { AGENT_PROVIDERS, resolveProvider } from '@agent-hollow/shared';
export type { ProviderInfo } from '@agent-hollow/shared';
