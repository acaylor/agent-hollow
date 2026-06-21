import { useMemo } from 'react';
import type { PendingQuestion } from '@agent-citadel/shared';
import { useWorld } from '../store';
import { useUi } from '../i18n';
import { sendAnswer } from '../ws';
import { clip } from '../util';

/** Card shown in the side panel when the selected hero has an open question. */
export function PendingQuestionCard({ sessionId }: { sessionId: string }) {
  const pending = useWorld((s) => s.pending);
  const t = useUi();
  const question: PendingQuestion | undefined = useMemo(
    () => Object.values(pending).find((q) => q.sessionId === sessionId),
    [pending, sessionId],
  );
  if (!question) return null;

  const title =
    question.kind === 'plan-approval' ? t.pqPlanTitle
    : question.kind === 'ask-user-question' ? t.pqQuestionTitle
    : t.pqPermissionTitle;

  return (
    <div
      style={{
        background: '#ef9f2722',
        boxShadow: 'inset 2px 0 0 #ef9f27, inset 0 0 0 1px #00000022',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <b style={{ color: '#ef9f27' }}>{title}</b>
      </div>

      {(question.tool || question.detail) && (
        <div style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.9, wordBreak: 'break-word' }}>
          {question.tool ? <b>{question.tool}</b> : null}
          {question.detail ? <span> · {clip(question.detail, 120)}</span> : null}
        </div>
      )}

      {question.kind === 'tool-permission' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="ghost" onClick={() => sendAnswer({ id: question.id, decision: { type: 'allow', scope: 'once' } })}>{t.pqAllow}</button>
          <button className="ghost" onClick={() => sendAnswer({ id: question.id, decision: { type: 'allow', scope: 'always' } })}>{t.pqAllowAlways}</button>
          <button className="ghost" onClick={() => sendAnswer({ id: question.id, decision: { type: 'deny' } })}>{t.pqDeny}</button>
        </div>
      )}

      {question.kind === 'plan-approval' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="ghost" onClick={() => sendAnswer({ id: question.id, decision: { type: 'approve-plan' } })}>{t.pqApprovePlan}</button>
          <button className="ghost" onClick={() => sendAnswer({ id: question.id, decision: { type: 'reject-plan' } })}>{t.pqRejectPlan}</button>
        </div>
      )}

      {question.kind === 'ask-user-question' && (
        <div style={{ opacity: 0.7, fontSize: 12 }}>{t.pqAnswerInTerminal}</div>
      )}
    </div>
  );
}
