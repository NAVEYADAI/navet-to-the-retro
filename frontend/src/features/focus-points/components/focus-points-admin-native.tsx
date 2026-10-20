import React, { useState } from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { trackEvent } from '@/lib/analytics';
import { useFocusPointsAdmin } from '../hooks/use-focus-points-admin';
import { assigneeChoices, draftTextFromComment, errorMessage, windowLabel } from '../focus-points-logic';
import { PointCardNative } from './point-card-native';
import { PointFormNative } from './point-form-native';
import { ProposalsCardNative } from './proposals-card-native';
import { TaskFormNative } from './task-form-native';
import { ActionButtonNative, CardNative, LabeledInputNative, PillPickerNative, TextNative } from './native-parts';
import type { FocusPoint, PointFormValues, Proposal } from '../types';
import { GuideAnchor } from '@/components/ui/guide-anchor';

const S = Strings.focusPoints;
type FormState = { mode: 'create'; proposal: Proposal | null } | { mode: 'edit'; point: FocusPoint };

export function FocusPointsAdminNative({ team, token, onBack }: { team: { id: number; name: string; members?: any[] }; token: string; onBack: () => void }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
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

  const windowState = sprintView?.window ?? 'NOT_OPEN';
  const livePoints = (pool?.points ?? []).filter((p) => p.status !== 'MERGED');
  const quota = pool?.quota ?? 3;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.color.bg }} contentContainerStyle={{ paddingTop: width >= 768 ? 80 : 100, paddingBottom: t.space[6] }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: t.space[4], gap: t.space[4], maxWidth: 1100, alignSelf: 'center', width: '100%' }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', gap: t.space[2] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <TextNative kind="title">{S.pageTitle}</TextNative>
            <TextNative kind="caption">{`${team.name} · ${S.pageSubtitle}`}</TextNative>
          </View>
          <View style={{ flexDirection: 'row-reverse' }}>
            <ActionButtonNative variant="ghost" label={Strings.common.refreshButton} disabled={admin.isLoading} onPress={() => { trackEvent('refresh_clicked', { screen: 'focus_points' }); admin.refresh(); }} />
            <ActionButtonNative variant="ghost" label={S.backButton} onPress={() => { trackEvent('focus_points_back_clicked'); onBack(); }} />
          </View>
        </View>

        {admin.loadError ? <TextNative kind="caption" color={t.color.status.danger.fg}>{admin.loadError}</TextNative> : null}
        {error ? <TextNative kind="caption" color={t.color.status.danger.fg}>{error}</TextNative> : null}
        {notice ? <TextNative kind="caption" color={t.color.status.success.fg}>{notice}</TextNative> : null}
        {admin.isLoading && !pool ? <TextNative kind="caption">{S.loading}</TextNative> : null}

        {pool ? (
          <>
            <CardNative>
              <PillPickerNative label={S.sprintLabel} value={sprintId ? String(sprintId) : ''} onChange={(v) => run(() => admin.chooseSprint(Number(v)), 'choose_sprint')} options={sprints.map((s) => ({ value: String(s.id), label: s.name }))} />
              <TextNative kind="caption">{`${S.selectedCount(sprintView?.points.length ?? 0, quota)} · ${windowLabel(windowState)}`}</TextNative>
              {windowState === 'OPEN' && !confirmClose ? <ActionButtonNative label={S.closeWindowButton} onPress={() => { trackEvent('rating_window_close_clicked'); setConfirmClose(true); }} /> : null}
              {confirmClose ? (
                <View style={{ gap: t.space[2] }}>
                  <TextNative color={t.color.status.danger.fg}>{S.closeWindowConfirm}</TextNative>
                  <View style={{ flexDirection: 'row-reverse', gap: t.space[2] }}>
                    <View style={{ flex: 1 }}>
                      <ActionButtonNative variant="danger" label={S.closeWindowConfirmButton} disabled={busy} onPress={() => run(async () => {
                        await admin.closeWindow();
                        setConfirmClose(false);
                        setNotice(S.closeWindowDone);
                      }, 'close_window')} />
                    </View>
                    <View style={{ flex: 1 }}><ActionButtonNative variant="ghost" label={S.cancelButton} onPress={() => { trackEvent('rating_window_close_cancelled'); setConfirmClose(false); }} /></View>
                  </View>
                </View>
              ) : null}
              <LabeledInputNative label={`${S.quotaTitle} — ${S.quotaHint}`} value={quotaDraft ?? String(quota)} onChangeText={setQuotaDraft} keyboardType="number-pad" />
              <ActionButtonNative variant="ghost" label={S.quotaSaveButton} disabled={busy || quotaDraft === null} onPress={() => run(async () => { await admin.saveQuota(Number(quotaDraft)); setQuotaDraft(null); }, 'quota')} />
            </CardNative>

            <ProposalsCardNative proposals={proposals} disabled={busy} onCreate={(p) => setForm({ mode: 'create', proposal: p })} onDismiss={(p) => run(() => admin.dismissProposal(p.commentId), 'dismiss_proposal')} />

            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
              <TextNative kind="title">{S.poolTitle}</TextNative>
              <GuideAnchor name="focus-new">
                <ActionButtonNative variant="primary" label={S.newPointButton} onPress={() => { trackEvent('focus_point_form_opened'); setForm({ mode: 'create', proposal: null }); }} />
              </GuideAnchor>
            </View>
            {livePoints.length === 0 ? <TextNative kind="caption">{S.poolEmpty}</TextNative> : null}
            {livePoints.map((point) => (
              <PointCardNative
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
      </View>

      <PointFormNative open={form !== null} mode={form?.mode ?? 'create'} initial={formInitial} fromProposal={form?.mode === 'create' && !!form.proposal} onSubmit={submitPoint} onClose={() => setForm(null)} />
      <TaskFormNative open={taskFor !== null} assignees={assigneeChoices(team.members)} onSubmit={async (input) => { if (taskFor !== null) { await admin.addTask(taskFor, input); setTaskFor(null); } }} onClose={() => setTaskFor(null)} />
    </ScrollView>
  );
}
