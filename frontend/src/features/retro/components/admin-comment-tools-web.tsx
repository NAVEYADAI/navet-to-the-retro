import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { useDeletedComments } from '../hooks/use-deleted-comments';
import { useWriteExtensions } from '../hooks/use-write-extensions';
import { extensionMemberOptions } from '../write-extension-members';
import { DeletedCommentsPanelWeb } from './deleted-comments-panel-web';
import { WriteExtensionsPanelWeb } from './write-extensions-panel-web';

interface AdminCommentToolsWebProps {
  sprintId: number;
  token: string;
  members: any[] | undefined;
  /** Bumped by the board after it deletes a comment, so an open "הערות שנמחקו" panel refetches. */
  deletedRefreshKey: number;
  /** After a grant / revoke — the board re-reads its own write access (an admin may extend themself). */
  onExtensionsChanged: () => void;
}

/** Feature 13 — the two admin-only panels under the sprint header (system/team admin, not a plain team leader). */
export function AdminCommentToolsWeb({ sprintId, token, members, deletedRefreshKey, onExtensionsChanged }: AdminCommentToolsWebProps) {
  const t = useTheme();
  const deleted = useDeletedComments(sprintId, token, deletedRefreshKey);
  const extensions = useWriteExtensions(sprintId, token, onExtensionsChanged);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
      <WriteExtensionsPanelWeb extensions={extensions} memberOptions={extensionMemberOptions(members)} />
      <DeletedCommentsPanelWeb deleted={deleted} />
    </Box>
  );
}
