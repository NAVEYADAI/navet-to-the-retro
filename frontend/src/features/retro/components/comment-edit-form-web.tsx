import React, { useState } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Field, Segmented } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { COMMENT_MAX_LENGTH, type BoardComment, type CategoryOption, type CommentColumn, type CommentPatch } from '../comment-types';

interface CommentEditFormWebProps {
  comment: BoardComment;
  categoryOptions: CategoryOption[];
  busy: boolean;
  error: string | null;
  onSave: (patch: CommentPatch) => void;
  onCancel: () => void;
}

/**
 * Feature 13 §13.2 — edit a comment inside its own card: the same textarea `<Field>` the compose form
 * uses, a column switch (move KEEP <-> IMPROVE) and a category picker. Only what changed is sent;
 * anonymity is fixed at posting, so it is not offered here. Keyboard: the textarea is focused when the form
 * opens, Esc cancels (the card puts focus back on its "⋯" button).
 */
export function CommentEditFormWeb({ comment, categoryOptions, busy, error, onSave, onCancel }: CommentEditFormWebProps) {
  const t = useTheme();
  const originalCategory = comment.categoryId ?? comment.category?.id ?? null;
  const [content, setContent] = useState(comment.content);
  const [type, setType] = useState<CommentColumn>(comment.type);
  const [categoryId, setCategoryId] = useState(originalCategory === null ? '' : String(originalCategory));
  const [localError, setLocalError] = useState<string | null>(null);

  const buildPatch = (): CommentPatch => {
    const patch: CommentPatch = {};
    if (content.trim() !== comment.content) patch.content = content.trim();
    if (type !== comment.type) patch.type = type;
    const nextCategory = categoryId ? Number(categoryId) : null;
    if (nextCategory !== originalCategory) patch.categoryId = nextCategory;
    return patch;
  };

  const handleSave = () => {
    const empty = !content.trim();
    // Every click on "save" counts, including the ones that end in "nothing to save" or an empty-text error.
    trackEvent('comment_edit_save_clicked', { empty, changed: !empty && Object.keys(buildPatch()).length > 0 });
    if (empty) {
      setLocalError(Strings.retroBoard.editEmptyError);
      return;
    }
    setLocalError(null);
    onSave(buildPatch());
  };

  const shownError = localError || error;

  return (
    <Box
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Escape' && !busy) onCancel();
      }}
      sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}
    >
      {shownError ? <Alert severity="error" sx={{ ...t.type.body }}>{shownError}</Alert> : null}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1] + 2}px`, alignItems: 'flex-start' }}>
        <Typography sx={{ ...t.type.label, color: t.color.textSecondary }}>{Strings.retroBoard.editColumnLabel}</Typography>
        <Segmented
          value={type}
          onChange={(next) => {
            if (next !== type) trackEvent('comment_edit_column_changed', { type: next });
            setType(next);
          }}
          options={[
            { value: 'KEEP', label: Strings.retroBoard.keepLabel, icon: 'check' },
            { value: 'IMPROVE', label: Strings.retroBoard.improveLabel, icon: 'wrench' },
          ]}
        />
      </Box>
      <Field
        type="textarea"
        label={Strings.retroBoard.editContentLabel}
        value={content}
        onChangeText={setContent}
        rows={3}
        maxLength={COMMENT_MAX_LENGTH}
        autoFocus
      />
      <Field
        type="select"
        label={Strings.retroBoard.editCategoryLabel}
        value={categoryId}
        onChangeText={(next) => {
          if (next !== categoryId) trackEvent('comment_edit_category_changed', { hasCategory: next !== '' });
          setCategoryId(next);
        }}
        options={[{ value: '', label: Strings.retroBoard.categoryNone }, ...categoryOptions]}
      />
      {comment.isAnonymous ? (
        <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>{Strings.retroBoard.editAnonymousHint}</Typography>
      ) : null}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px` }}>
        <Button variant="secondary" size="sm" icon="check" onPress={handleSave} disabled={busy} loading={busy}>
          {Strings.retroBoard.editSaveButton}
        </Button>
        <Button variant="ghost" size="sm" onPress={onCancel} disabled={busy}>
          {Strings.retroBoard.editCancelButton}
        </Button>
      </Box>
    </Box>
  );
}
