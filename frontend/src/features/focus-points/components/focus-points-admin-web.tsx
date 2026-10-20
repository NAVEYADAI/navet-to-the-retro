import React, { useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge, Button, Card, Field, Page, PageHeader } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { useFocusPointsAdmin } from '../hooks/use-focus-points-admin';
import { assigneeChoices, draftTextFromComment, errorMessage, windowLabel } from '../focus-points-logic';
import { PointCardWeb } from './point-card-web';
import { PointFormWeb } from './point-form-web';
import { ProposalsCardWeb } from './proposals-card-web';
import { TaskFormWeb } from './task-form-web';
import type { FocusPoint, PointFormValues, Proposal } from '../types';
import { GuideAnchor } from '@/components/ui/guide-anchor';

const S = Strings.focusPoints;

type FormState = { mode: 'create'; proposal: Proposal | null } | { mode: 'edit'; point: FocusPoint };

interface FocusPointsAdminWebProps {
  team: { id: number; name: string; members?: any[] };
  token: string;
  onBack: () => void;
}

/** The management space for the team leader and team admin: quota, proposals, the pool, the sprint's selection and window. */
export function FocusPointsAdminWeb({ team, token, onBack }: FocusPointsAdminWebProps) {
  const t = useTheme();
  const admin = useFocusPointsAdmin(team.id, token);
  const { pool, proposals, sprints, sprintId, sprintView } = admin;
  const [form, setForm] = useState<FormState | null>(null);
  const [taskFor, setTaskFor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [quotaDraft, setQuotaDraft] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, name = 'unknown') => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: any) {
      // Failed manager actions are exactly what process tracking needs (quota hit = 409, no access = 403 ...).
      trackEvent('focus_point_action_failed', { teamId: team.id, action: name, status: err?.response?.status ?? 0 });
      setError(errorMessage(err, S.actionError));
    } finally {
      setBusy(false);
    }
  };

  const formInitial: PointFormValues = form?.mode === 'edit'
    ? { kind: form.point.kind, text: form.point.text, initialScore: form.point.initialScore ?? 3 }
    : { kind: form?.mode === 'create' && form.proposal?.type === 'KEEP' ? 'KEEP' : 'IMPROVE', text: form?.mode === 'create' && form.proposal ? draftTextFromComment(form.proposal.content) : '', initialScore: 3 };

  const submitPoint = async (values: PointFormValues) => {
    if (!form) return;
    if (form.mode === 'create') {
      await admin.createPoint({
        kind: values.kind, text: values.text,
        initialScore: values.kind === 'IMPROVE' ? values.initialScore : undefined,
        sourceCommentIds: form.proposal ? [form.proposal.commentId] : undefined,
      });
    } else if (values.text !== form.point.text) {
      await admin.editPoint(form.point.id, { text: values.text });
    }
    setForm(null);
  };

  const selectedCount = sprintView ? sprintView.points.length : 0;
  const windowState = sprintView?.window ?? 'NOT_OPEN';
  const livePoints = (pool?.points ?? []).filter((p) => p.status !== 'MERGED');
  const quota = pool?.quota ?? 3;

  return (
    <Page>
      <PageHeader
        title={S.pageTitle}
        subtitle={`${team.name} · ${S.pageSubtitle}`}
        action={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[1]}px` }}>
            <Button variant="ghost" size="sm" icon="refresh" iconOnlyOnMobile onPress={() => { trackEvent('refresh_clicked', { screen: 'focus_points' }); admin.refresh(); }} disabled={admin.isLoading}>
              {Strings.common.refreshButton}
            </Button>
            <Button variant="ghost" size="sm" onPress={() => { trackEvent('focus_points_back_clicked'); onBack(); }}>{S.backButton}</Button>
          </Box>
        }
      />

      {admin.loadError ? <Alert severity="error" sx={{ ...t.type.body }}>{admin.loadError}</Alert> : null}
      {error ? <Alert severity="error" sx={{ ...t.type.body }} onClose={() => setError(null)}>{error}</Alert> : null}
      {notice ? <Alert severity="success" sx={{ ...t.type.body }} onClose={() => setNotice(null)}>{notice}</Alert> : null}

      {admin.isLoading && !pool ? (
        <Typography sx={{ ...t.type.body, color: t.color.textSecondary, textAlign: 'center' }}>{S.loading}</Typography>
      ) : pool ? (
        <>
          <Card>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: `${t.space[3]}px` }}>
              <Box sx={{ minWidth: 220, flex: '1 1 220px' }}>
                <Field type="select" label={S.sprintLabel} value={sprintId ? String(sprintId) : ''} onChangeText={(v) => run(() => admin.chooseSprint(Number(v)), 'choose_sprint')}
                  options={sprints.map((s) => ({ value: String(s.id), label: s.name }))} />
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
                <Badge tone="accent">{S.selectedCount(selectedCount, quota)}</Badge>
                <Badge tone={windowState === 'OPEN' ? 'success' : 'neutral'}>{windowLabel(windowState)}</Badge>
              </Box>
            </Box>
            {windowState === 'OPEN' && !confirmClose ? (
              <Box><Button variant="secondary" size="sm" onPress={() => { trackEvent('rating_window_close_clicked'); setConfirmClose(true); }}>{S.closeWindowButton}</Button></Box>
            ) : null}
            {confirmClose ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
                <Typography sx={{ ...t.type.body, color: t.color.status.danger.fg }}>{S.closeWindowConfirm}</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px` }}>
                  <Button variant="danger" size="sm" disabled={busy} onPress={() => run(async () => {
                    const outcomes = await admin.closeWindow();
                    setConfirmClose(false);
                    setNotice([S.closeWindowDone, ...outcomes.map((o) => {
                      const name = pool.points.find((p) => p.id === o.focusPointId)?.text ?? '';
                      const label = o.outcome === 'CLOSED' ? S.outcomeClosed : o.outcome === 'ARCHIVED' ? S.outcomeArchived : o.outcome === 'NOT_COUNTED' ? S.outcomeNotCounted : '';
                      return label ? `${name}: ${label}` : '';
                    })].filter(Boolean).join(' · '));
                  }, 'close_window')}>{S.closeWindowConfirmButton}</Button>
                  <Button variant="ghost" size="sm" onPress={() => { trackEvent('rating_window_close_cancelled'); setConfirmClose(false); }}>{S.cancelButton}</Button>
                </Box>
              </Box>
            ) : null}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: `${t.space[2]}px`, borderTop: `1px solid ${t.color.border}`, paddingTop: `${t.space[3]}px` }}>
              <Box sx={{ width: 140 }}>
                <Field type="number" label={S.quotaTitle} hint={S.quotaHint} value={quotaDraft ?? String(quota)} onChangeText={setQuotaDraft} />
              </Box>
              <Button variant="ghost" size="sm" disabled={busy || quotaDraft === null} onPress={() => run(async () => { await admin.saveQuota(Number(quotaDraft)); setQuotaDraft(null); }, 'quota')}>{S.quotaSaveButton}</Button>
            </Box>
          </Card>

          <ProposalsCardWeb
            proposals={proposals}
            disabled={busy}
            onCreate={(p) => setForm({ mode: 'create', proposal: p })}
            onDismiss={(p) => run(() => admin.dismissProposal(p.commentId), 'dismiss_proposal')}
          />

          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[2]}px` }}>
            <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>{S.poolTitle}</Typography>
            <GuideAnchor name="focus-new">
              <Button variant="primary" size="sm" icon="plus" onPress={() => { trackEvent('focus_point_form_opened'); setForm({ mode: 'create', proposal: null }); }}>{S.newPointButton}</Button>
            </GuideAnchor>
          </Box>
          {livePoints.length === 0 ? <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>{S.poolEmpty}</Typography> : null}
          {livePoints.map((point) => (
            <PointCardWeb
              key={point.id}
              point={point}
              resultsHidden={pool.resultsHidden}
              sprintId={sprintId}
              mergeTargets={livePoints.filter((o) => o.id !== point.id && o.kind === point.kind && o.status !== 'ARCHIVED')}
              disabled={busy}
              onToggleSelected={(sel) => run(() => admin.setSelected(point.id, sel), sel ? 'select' : 'deselect')}
              onEdit={() => { trackEvent('focus_point_edit_opened'); setForm({ mode: 'edit', point }); }}
              onSetStatus={(status) => run(() => admin.editPoint(point.id, { status }), status === 'ARCHIVED' ? 'archive' : 'reopen')}
              onSetWatch={(n) => run(() => admin.editPoint(point.id, { watchSprintsLeft: n }), 'watch')}
              onMerge={(intoId) => run(() => admin.mergePoint(point.id, intoId), 'merge')}
              onAddTask={() => setTaskFor(point.id)}
              onTaskStatus={(taskId, status) => run(() => admin.setTaskStatus(taskId, status), 'task_status')}
              onRemoveTask={(taskId) => run(() => admin.removeTask(taskId), 'task_delete')}
            />
          ))}
        </>
      ) : null}

      <PointFormWeb
        open={form !== null}
        mode={form?.mode ?? 'create'}
        initial={formInitial}
        fromProposal={form?.mode === 'create' && !!form.proposal}
        onSubmit={submitPoint}
        onClose={() => setForm(null)}
      />
      <TaskFormWeb
        open={taskFor !== null}
        assignees={assigneeChoices(team.members)}
        onSubmit={async (input) => { if (taskFor !== null) { await admin.addTask(taskFor, input); setTaskFor(null); } }}
        onClose={() => setTaskFor(null)}
      />
    </Page>
  );
}
