import type { ReactNode } from 'react';
import type { AgentKind } from '@agent-citadel/shared';
import { resolveProvider } from '../theme/providers';

/**
 * Herb providera (adapter React nad AGENT_PROVIDERS). Claude/nieznany → null (brak herba).
 * - 'pill': pigułka z pełną nazwą (panel sesji).
 * - 'chip': 14×14 kwadrat z literą + tooltip pełnej nazwy (lista miast, „Widziane modele").
 */
export function ProviderEmblem({
  agent,
  variant,
}: {
  agent: AgentKind | undefined;
  variant: 'pill' | 'chip';
}): ReactNode {
  const { label, labelShort, color } = resolveProvider(agent);
  if (color === null) return null;

  if (variant === 'pill') {
    return (
      <span
        className="px"
        style={{
          marginLeft: 6,
          fontSize: 10,
          padding: '1px 6px',
          borderRadius: 4,
          background: `${color}33`,
          color,
          border: `1px solid ${color}66`,
          verticalAlign: 'middle',
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      title={label}
      style={{
        background: color,
        color: '#15140f',
        width: 14,
        height: 14,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontWeight: 700,
      }}
    >
      {labelShort}
    </span>
  );
}
