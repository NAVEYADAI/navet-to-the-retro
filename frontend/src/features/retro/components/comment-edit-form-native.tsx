import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { ActionButtonNative, LabeledInputNative, PillPickerNative, rnText } from '@/features/focus-points/components/native-parts';
import { trackEvent } from '@/lib/analytics';
import { COMMENT_MAX_LENGTH, type BoardComment, type CategoryOption, type CommentColumn, type CommentPatch } from '../comment-types';

interface CommentEditFormNativeProps {
  comment: BoardComment;
  categoryOptions: CategoryOption[];
  busy: boolean;
  error: string | null;
  onSave: (patch: CommentPatch) => void;
  onCancel: () => void;
}

/** Feature 13 §13.2 — native twin of comment-edit-form-web.tsx: content, column switch, category. */
export function CommentEditFormNative({ comment, categoryOptions, busy, error, onSave, onCancel }: CommentEditFormNativeProps) {
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
    // Every tap on "save" counts, including the ones that end in "nothing to save" or an empty-text error.
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
    <View style={{ gap: t.space[3] }}>
      {!!shownError && (
        <View style={{ backgroundColor: t.color.status.danger.bg, borderWidth: 1, borderColor: t.color.status.danger.border, borderRadius: t.radius.field, padding: t.space[2] }}>
          <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>{shownError}</Text>
        </View>
      )}
      <PillPickerNative
        label={Strings.retroBoard.editColumnLabel}
        value={type}
        onChange={(v) => {
          if (v !== type) trackEvent('comment_edit_column_changed', { type: v });
          setType(v as CommentColumn);
        }}
        options={[
          { value: 'KEEP', label: Strings.retroBoard.keepLabel },
          { value: 'IMPROVE', label: Strings.retroBoard.improveLabel },
        ]}
      />
      <LabeledInputNative label={Strings.retroBoard.editContentLabel} value={content} onChangeText={setContent} multiline maxLength={COMMENT_MAX_LENGTH} autoFocus />
      <PillPickerNative
        label={Strings.retroBoard.editCategoryLabel}
        value={categoryId}
        onChange={(v) => {
          if (v !== categoryId) trackEvent('comment_edit_category_changed', { hasCategory: v !== '' });
          setCategoryId(v);
        }}
        options={[{ value: '', label: Strings.retroBoard.categoryNone }, ...categoryOptions]}
      />
      {comment.isAnonymous && (
        <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>{Strings.retroBoard.editAnonymousHint}</Text>
      )}
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
        <ActionButtonNative label={Strings.retroBoard.editSaveButton} onPress={handleSave} disabled={busy} loading={busy} />
        <ActionButtonNative label={Strings.retroBoard.editCancelButton} variant="ghost" onPress={onCancel} disabled={busy} />
      </View>
    </View>
  );
}
