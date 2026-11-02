import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/design/theme-context';
import { useDeletedComments } from '../hooks/use-deleted-comments';
import { useWriteExtensions } from '../hooks/use-write-extensions';
import { extensionMemberOptions } from '../write-extension-members';
import { DeletedCommentsPanelNative } from './deleted-comments-panel-native';
import { WriteExtensionsPanelNative } from './write-extensions-panel-native';

interface AdminCommentToolsNativeProps {
  sprintId: number;
  token: string;
  members: any[] | undefined;
  deletedRefreshKey: number;
  onExtensionsChanged: () => void;
}

/** Feature 13 — native twin of admin-comment-tools-web.tsx. */
export function AdminCommentToolsNative({ sprintId, token, members, deletedRefreshKey, onExtensionsChanged }: AdminCommentToolsNativeProps) {
  const t = useTheme();
  const deleted = useDeletedComments(sprintId, token, deletedRefreshKey);
  const extensions = useWriteExtensions(sprintId, token, onExtensionsChanged);
  return (
    <View style={{ gap: t.space[3] }}>
      <WriteExtensionsPanelNative extensions={extensions} memberOptions={extensionMemberOptions(members)} />
      <DeletedCommentsPanelNative deleted={deleted} />
    </View>
  );
}
