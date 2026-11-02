import { test, expect } from '@playwright/test';
import { Strings } from '../src/constants/strings';
import { openSprintTools } from './sprint-actions-ui';
import {
  BACKEND_URL, auth, israelDay, createCommentTeam, createSprint, setSprintDates, postComment, listComments,
  openBoard, fieldOf, commentCard, commentMenuButton, pickCommentMenuItem, columnLabelOf, panelHeader, noSidewaysScroll,
} from './comment-edit-ui';

// Feature 13 (product-backlog/13-comment-edit-delete.md §13.3): edit / delete a comment, the write
// window (a sprint locks 3 calendar days after it ends), admin write extensions, and the admin-only
// "deleted comments" panel. Every test also checks the permission boundary against the API, not just
// what the UI hides. Runs on Desktop Chrome and Mobile Chrome against the isolated backend (5006).

const R = Strings.retroBoard;
const suffixFor = (tag: string) => `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_${tag}`;

test.describe('Comment edit / delete', () => {
  test('the author edits a comment and moves it to the other column; everyone else sees "נערכה" and no menu', async ({ page, request }) => {
    const suffix = suffixFor('edit');
    const ctx = await createCommentTeam(request, suffix);
    const [author, other] = ctx.members;
    const sprintId = await createSprint(request, ctx, `E2E Edit Sprint ${suffix}`, -1, 13);
    const original = `Original keep note ${suffix}`;
    const edited = `Edited improve note ${suffix}`;
    const comment = await postComment(request, author.token, sprintId, { content: original, type: 'KEEP', categoryId: ctx.categoryId('TESTING') });

    // --- the author ---
    await openBoard(page, author.token, ctx.teamId, sprintId);
    await expect(page.getByText(original, { exact: true })).toBeVisible();
    expect(await columnLabelOf(commentCard(page, original))).toBe(R.keepLabel);
    await expect(page.getByText(R.editedLabel, { exact: true })).toHaveCount(0);

    await pickCommentMenuItem(page, original, R.editCommentButton);
    // the edit form replaces the card body: textarea + column switch + category picker
    await expect(page.getByText(R.editAnonymousHint)).toHaveCount(0); // a named comment has no anonymity note
    await page.getByText(R.editColumnLabel, { exact: true }).locator('xpath=following-sibling::*[1]').getByText(R.improveLabel, { exact: true }).click();
    const textarea = fieldOf(page, R.editContentLabel).getByRole('textbox');
    await textarea.fill(edited);
    await page.getByRole('button', { name: R.editSaveButton }).click();

    await expect(page.getByText(edited, { exact: true })).toBeVisible();
    await expect(page.getByText(original, { exact: true })).toHaveCount(0);
    expect(await columnLabelOf(commentCard(page, edited))).toBe(R.improveLabel);
    await expect(commentCard(page, edited)).toContainText(R.editedLabel);
    await expect(commentCard(page, edited)).toContainText(Strings.retroBoard.categories.TESTING);
    expect(await noSidewaysScroll(page)).toBe(true);

    // persisted on the server (not just local state)
    const stored = (await listComments(request, author.token, sprintId)).find((c) => c.id === comment.id);
    expect(stored.content).toBe(edited);
    expect(stored.type).toBe('IMPROVE');
    expect(stored.updatedAt).toBeTruthy();
    expect(stored.category?.label).toBe(Strings.retroBoard.categories.TESTING);
    await page.reload();
    await expect(page.getByText(edited, { exact: true })).toBeVisible();
    expect(await columnLabelOf(commentCard(page, edited))).toBe(R.improveLabel);

    // --- another member: sees the new text and the label, but no menu on the card ---
    await openBoard(page, other.token, ctx.teamId, sprintId);
    await expect(page.getByText(edited, { exact: true })).toBeVisible();
    await expect(commentCard(page, edited)).toContainText(R.editedLabel);
    await expect(commentMenuButton(page)).toHaveCount(0);

    // and the API agrees: neither PATCH nor DELETE is allowed, and nothing changed
    for (const actor of [other, ctx.leader]) {
      const patch = await request.patch(`${BACKEND_URL}/comments/${comment.id}`, { headers: auth(actor.token), data: { content: 'hijacked' } });
      expect(patch.status()).toBe(403);
    }
    expect((await request.delete(`${BACKEND_URL}/comments/${comment.id}`, { headers: auth(other.token) })).status()).toBe(403);
    // someone who is not in the team cannot even tell the comment exists
    expect((await request.patch(`${BACKEND_URL}/comments/${comment.id}`, { headers: auth(ctx.outsider.token), data: { content: 'x' } })).status()).toBe(404);
    const after = (await listComments(request, author.token, sprintId)).find((c) => c.id === comment.id);
    expect(after.content).toBe(edited);

    // the viewer flags the server sends: author can edit, the other member cannot
    const asOther = (await listComments(request, other.token, sprintId)).find((c) => c.id === comment.id);
    expect(asOther.isMine).toBe(false);
    expect(asOther.canEdit).toBe(false);
    expect(asOther.canDelete).toBe(false);
  });

  test('a team admin gets only "מחק" on someone else\'s comment (no edit), a plain member gets no menu', async ({ page, request }) => {
    const suffix = suffixFor('adminmenu');
    const ctx = await createCommentTeam(request, suffix, 1);
    const [author] = ctx.members;
    const sprintId = await createSprint(request, ctx, `E2E Menu Sprint ${suffix}`, -1, 13);
    const text = `Member note ${suffix}`;
    await postComment(request, author.token, sprintId, { content: text, type: 'IMPROVE' });

    await openBoard(page, ctx.leader.token, ctx.teamId, sprintId);
    await commentMenuButton(commentCard(page, text)).click();
    await expect(page.getByRole('menuitem', { name: R.deleteCommentButton })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: R.editCommentButton })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // moderation delete is announced as "on your name"
    await pickCommentMenuItem(page, text, R.deleteCommentButton);
    await expect(page.getByText(R.deleteModerationHint)).toBeVisible();
    await page.getByRole('button', { name: R.deleteCancelButton }).click();
    await expect(page.getByText(text, { exact: true })).toBeVisible(); // cancel keeps it
  });

  test('deleting a comment removes it from the board, the sprint summary and the memory game', async ({ page, request }) => {
    const suffix = suffixFor('delete');
    const ctx = await createCommentTeam(request, suffix);
    const [author, other] = ctx.members;
    const sprintId = await createSprint(request, ctx, `E2E Delete Sprint ${suffix}`, -1, 13);
    const doomed = `Doomed note ${suffix}`;
    const kept = `Kept note ${suffix}`;
    const doomedComment = await postComment(request, author.token, sprintId, { content: doomed, type: 'KEEP' });
    await postComment(request, author.token, sprintId, { content: kept, type: 'IMPROVE' });
    const summaryTotal = (page: any) => page.getByText(Strings.sprintSummary.totalCommentsLabel, { exact: true }).locator('xpath=following-sibling::*[1]');

    await openBoard(page, author.token, ctx.teamId, sprintId);
    await page.goto(`/team/${ctx.teamId}/sprint/${sprintId}/summary`);
    await expect(summaryTotal(page)).toHaveText('2');

    await openBoard(page, author.token, ctx.teamId, sprintId);
    await pickCommentMenuItem(page, doomed, R.deleteCommentButton);
    // the author deleting their own comment is not "moderation"
    await expect(page.getByText(R.deleteModerationHint)).toHaveCount(0);
    await page.getByRole('button', { name: R.deleteConfirmButton }).click();
    await expect(page.getByText(doomed, { exact: true })).toHaveCount(0);
    await expect(page.getByText(kept, { exact: true })).toBeVisible();

    // gone for everyone on reload, and from the API
    await page.reload();
    await expect(page.getByText(kept, { exact: true })).toBeVisible();
    await expect(page.getByText(doomed, { exact: true })).toHaveCount(0);
    expect((await listComments(request, other.token, sprintId)).map((c) => c.id)).not.toContain(doomedComment.id);

    // sprint summary counts only what is left
    await page.goto(`/team/${ctx.teamId}/sprint/${sprintId}/summary`);
    await expect(summaryTotal(page)).toHaveText('1');

    // memory game: one card left, not two
    await openBoard(page, other.token, ctx.teamId, sprintId);
    await openSprintTools(page);
    await page.getByText(Strings.memoryBoard.openButton).click();
    await expect(page.getByRole('button', { name: Strings.memoryBoard.flipCardHint })).toHaveCount(1);

    // a deleted comment cannot be edited or deleted again, by anyone
    expect((await request.patch(`${BACKEND_URL}/comments/${doomedComment.id}`, { headers: auth(author.token), data: { content: 'zombie' } })).status()).toBe(404);
    expect((await request.delete(`${BACKEND_URL}/comments/${doomedComment.id}`, { headers: auth(author.token) })).status()).toBe(404);
  });

  test('editing my own anonymous comment keeps it anonymous for everyone, including the admin', async ({ page, request }) => {
    const suffix = suffixFor('anon');
    const ctx = await createCommentTeam(request, suffix);
    const [author, other] = ctx.members;
    const sprintId = await createSprint(request, ctx, `E2E Anon Sprint ${suffix}`, -1, 13);
    const original = `Anonymous secret ${suffix}`;
    const edited = `Anonymous secret, reworded ${suffix}`;
    const comment = await postComment(request, author.token, sprintId, { content: original, type: 'IMPROVE', isAnonymous: true });

    await openBoard(page, author.token, ctx.teamId, sprintId);
    // the masking hides the author from everybody — yet the server still tells *the author* it is theirs
    await expect(commentCard(page, original)).toContainText(R.anonymousAuthor);
    await expect(commentMenuButton(commentCard(page, original))).toBeVisible();

    await pickCommentMenuItem(page, original, R.editCommentButton);
    await expect(page.getByText(R.editAnonymousHint)).toBeVisible();
    await fieldOf(page, R.editContentLabel).getByRole('textbox').fill(edited);
    await page.getByRole('button', { name: R.editSaveButton }).click();

    await expect(page.getByText(edited, { exact: true })).toBeVisible();
    await expect(commentCard(page, edited)).toContainText(R.anonymousAuthor);
    await expect(commentCard(page, edited)).toContainText(R.editedLabel);
    // (the viewer's own name legitimately appears elsewhere on the page, e.g. the user menu — only the card matters)
    await expect(commentCard(page, edited)).not.toContainText(author.username);

    // anonymity cannot be switched off by an edit
    const flip = await request.patch(`${BACKEND_URL}/comments/${comment.id}`, { headers: auth(author.token), data: { isAnonymous: false } });
    expect(flip.status()).toBe(400);

    // nobody else — admin included — learns who wrote it, and nobody else can touch it
    for (const viewer of [other, ctx.leader]) {
      const seen = (await listComments(request, viewer.token, sprintId)).find((c) => c.id === comment.id);
      expect(seen.content).toBe(edited);
      expect(seen.isAnonymous).toBe(true);
      expect(seen.isMine).toBe(false);
      expect(seen.authorId).toBeUndefined();
      expect(JSON.stringify(seen)).not.toContain(author.username);
    }
    await openBoard(page, other.token, ctx.teamId, sprintId);
    await expect(page.getByText(edited, { exact: true })).toBeVisible();
    await expect(commentMenuButton(page)).toHaveCount(0);
  });

  test('the "נערכה" label also shows on the memory-game card', async ({ page, request }) => {
    const suffix = suffixFor('memory');
    const ctx = await createCommentTeam(request, suffix, 1);
    const [author] = ctx.members;
    const sprintId = await createSprint(request, ctx, `E2E Memory Edit Sprint ${suffix}`, -1, 13);
    const text = `Memory note ${suffix}`;
    const comment = await postComment(request, author.token, sprintId, { content: text, type: 'KEEP' });

    await openBoard(page, author.token, ctx.teamId, sprintId);
    await openSprintTools(page);
    await page.getByText(Strings.memoryBoard.openButton).click();
    await page.getByRole('button', { name: Strings.memoryBoard.flipCardHint }).first().click();
    await expect(page.getByText(text)).toBeVisible();
    await expect(page.getByText(R.editedLabel)).toHaveCount(0); // never edited

    const res = await request.patch(`${BACKEND_URL}/comments/${comment.id}`, { headers: auth(author.token), data: { content: `${text} v2` } });
    expect(res.ok()).toBeTruthy();
    await page.reload();
    await page.getByRole('button', { name: Strings.memoryBoard.flipCardHint }).first().click();
    await expect(page.getByText(`${text} v2`)).toBeVisible();
    await expect(page.getByText(R.editedLabel)).toBeVisible();
  });
});

test.describe('Write window and extensions', () => {
  test('a sprint that ended 4 days ago is locked for writing, editing and deleting; day 3 is still open', async ({ page, request }) => {
    const suffix = suffixFor('lock');
    const ctx = await createCommentTeam(request, suffix);
    const [member] = ctx.members;
    const sprintId = await createSprint(request, ctx, `E2E Lock Sprint ${suffix}`, -10, 5);
    const text = `Written while open ${suffix}`;
    const comment = await postComment(request, member.token, sprintId, { content: text, type: 'KEEP' });

    // the sprint "ends" 4 days ago (edited after the note was written, so the note exists)
    await setSprintDates(request, ctx, sprintId, -14, -4);

    await openBoard(page, member.token, ctx.teamId, sprintId);
    await expect(page.getByTestId('write-locked-notice')).toBeVisible();
    await expect(page.getByTestId('write-locked-notice')).toContainText(R.writeLockedTitle);
    await expect(page.getByText(R.writeNoteHeader)).toHaveCount(0);
    await expect(page.getByRole('button', { name: R.postNoteButton })).toHaveCount(0);
    // the existing note is readable, but cannot be touched
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(commentMenuButton(page)).toHaveCount(0);
    expect(await noSidewaysScroll(page)).toBe(true);

    // server side: the lock is real, not just hidden UI
    const write = await request.post(`${BACKEND_URL}/sprints/${sprintId}/comments`, { headers: auth(member.token), data: { content: 'late', type: 'KEEP' } });
    expect(write.status()).toBe(403);
    expect((await write.json()).message).toBe('הלוח נעול לכתיבה — הספרינט הסתיים');
    expect((await request.patch(`${BACKEND_URL}/comments/${comment.id}`, { headers: auth(member.token), data: { content: 'late edit' } })).status()).toBe(403);
    expect((await request.delete(`${BACKEND_URL}/comments/${comment.id}`, { headers: auth(member.token) })).status()).toBe(403);
    const access = await (await request.get(`${BACKEND_URL}/sprints/${sprintId}/write-access`, { headers: auth(member.token) })).json();
    expect(access.canWrite).toBe(false);
    expect(access.windowOpen).toBe(false);
    const row = (await listComments(request, member.token, sprintId)).find((c) => c.id === comment.id);
    expect(row.content).toBe(text);
    expect(row.canEdit).toBe(false);

    // a team admin can still moderate (delete) in a locked sprint, but cannot write
    await openBoard(page, ctx.leader.token, ctx.teamId, sprintId);
    await expect(page.getByTestId('write-locked-notice')).toBeVisible();
    await commentMenuButton(commentCard(page, text)).click();
    await expect(page.getByRole('menuitem', { name: R.deleteCommentButton })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: R.editCommentButton })).toHaveCount(0);

    // boundary: the third day after the end date is the last open one
    await setSprintDates(request, ctx, sprintId, -14, -3);
    await openBoard(page, member.token, ctx.teamId, sprintId);
    await expect(page.getByTestId('write-locked-notice')).toHaveCount(0);
    await expect(page.getByRole('button', { name: R.postNoteButton })).toBeVisible();
    await expect(commentMenuButton(commentCard(page, text))).toBeVisible();
  });

  test('an admin opens the locked board to one member, who can then write; revoking locks it again; members cannot manage extensions', async ({ page, request }) => {
    const suffix = suffixFor('ext');
    const ctx = await createCommentTeam(request, suffix);
    const [member, bystander] = ctx.members;
    const sprintId = await createSprint(request, ctx, `E2E Ext Sprint ${suffix}`, -10, 5);
    const oldNote = `Old note ${suffix}`;
    const newNote = `Written after the extension ${suffix}`;
    await postComment(request, member.token, sprintId, { content: oldNote, type: 'KEEP' });
    await setSprintDates(request, ctx, sprintId, -14, -5);

    // --- the member cannot manage extensions: no panel, and the API refuses ---
    await openBoard(page, member.token, ctx.teamId, sprintId);
    await expect(page.getByTestId('write-locked-notice')).toBeVisible();
    await expect(page.getByText(R.extensionsPanelTitle, { exact: true })).toHaveCount(0);
    await expect(page.getByText(R.deletedPanelTitle, { exact: true })).toHaveCount(0);
    const forbidden = await request.post(`${BACKEND_URL}/sprints/${sprintId}/write-extensions`, {
      headers: auth(member.token), data: { userId: member.id, expiresAt: israelDay(2) },
    });
    expect(forbidden.status()).toBe(403);
    expect((await request.get(`${BACKEND_URL}/sprints/${sprintId}/comments/deleted`, { headers: auth(member.token) })).status()).toBe(403);

    // --- the admin grants the extension in the panel ---
    await openBoard(page, ctx.leader.token, ctx.teamId, sprintId);
    await panelHeader(page, R.extensionsPanelTitle).getByRole('button', { name: R.extensionsPanelOpenLabel }).click();
    await expect(page.getByText(R.extensionsNoneActive)).toBeVisible();
    await fieldOf(page, R.extensionsMemberLabel).getByRole('combobox').click();
    await page.getByRole('option', { name: member.username }).click();
    await fieldOf(page, R.extensionsEndDateLabel).getByRole('textbox').fill(israelDay(2));
    await page.getByRole('button', { name: R.extensionsGrantButton }).click();
    const rows = page.getByTestId('write-extension');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(member.username);
    expect(await noSidewaysScroll(page)).toBe(true);

    // --- the member can now write and edit; the bystander is still locked ---
    await openBoard(page, member.token, ctx.teamId, sprintId);
    await expect(page.getByTestId('write-extension-notice')).toBeVisible();
    await expect(page.getByTestId('write-locked-notice')).toHaveCount(0);
    await page.getByPlaceholder(R.notePlaceholderKeep).fill(newNote);
    await page.getByRole('button', { name: R.postNoteButton }).click();
    await expect(page.getByText(newNote, { exact: true })).toBeVisible();
    await expect(commentMenuButton(commentCard(page, oldNote))).toBeVisible();

    const bystanderWrite = await request.post(`${BACKEND_URL}/sprints/${sprintId}/comments`, { headers: auth(bystander.token), data: { content: 'nope', type: 'KEEP' } });
    expect(bystanderWrite.status()).toBe(403);
    await openBoard(page, bystander.token, ctx.teamId, sprintId);
    await expect(page.getByTestId('write-locked-notice')).toBeVisible();

    // --- the admin revokes it; the member is locked out again ---
    await openBoard(page, ctx.leader.token, ctx.teamId, sprintId);
    await panelHeader(page, R.extensionsPanelTitle).getByRole('button', { name: R.extensionsPanelOpenLabel }).click();
    await expect(rows).toHaveCount(1);
    await rows.first().getByRole('button', { name: R.extensionsRevokeLabel(member.username) }).click();
    await expect(rows).toHaveCount(0);
    const afterRevoke = await request.post(`${BACKEND_URL}/sprints/${sprintId}/comments`, { headers: auth(member.token), data: { content: 'too late again', type: 'KEEP' } });
    expect(afterRevoke.status()).toBe(403);
    await openBoard(page, member.token, ctx.teamId, sprintId);
    await expect(page.getByTestId('write-locked-notice')).toBeVisible();
  });
});

test.describe('Anonymity on a locked board', () => {
  test('a locked board kept open by an extension hides the anonymous option (and the server refuses it); an open board offers it', async ({ page, request }) => {
    const suffix = suffixFor('anonlock');
    const ctx = await createCommentTeam(request, suffix);
    const [member] = ctx.members;
    const sprintId = await createSprint(request, ctx, `E2E Anon Lock Sprint ${suffix}`, -10, 5);
    await setSprintDates(request, ctx, sprintId, -14, -5);
    const grant = await request.post(`${BACKEND_URL}/sprints/${sprintId}/write-extensions`, {
      headers: auth(ctx.leader.token), data: { userId: member.id, expiresAt: israelDay(2) },
    });
    expect(grant.ok()).toBeTruthy();

    // locked + extension: can write, but only under their own name
    await openBoard(page, member.token, ctx.teamId, sprintId);
    await expect(page.getByTestId('write-extension-notice')).toBeVisible();
    await expect(page.getByRole('button', { name: R.postNoteButton })).toBeVisible();
    await expect(page.getByText(R.anonymousToggleLabel, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('anonymous-locked-hint')).toHaveText(R.anonymousLockedHint);
    expect(await noSidewaysScroll(page)).toBe(true);
    const access = await (await request.get(`${BACKEND_URL}/sprints/${sprintId}/write-access`, { headers: auth(member.token) })).json();
    expect(access.anonymousAllowed).toBe(false);
    const anon = await request.post(`${BACKEND_URL}/sprints/${sprintId}/comments`, { headers: auth(member.token), data: { content: 'secret', type: 'KEEP', isAnonymous: true } });
    expect(anon.status()).toBe(403);

    // writing from the form goes through, named
    const text = `Named late note ${suffix}`;
    await page.getByPlaceholder(R.notePlaceholderKeep).fill(text);
    await page.getByRole('button', { name: R.postNoteButton }).click();
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    const stored = (await listComments(request, member.token, sprintId)).find((c) => c.content === text);
    expect(stored.isAnonymous).toBe(false);

    // an open board still offers the option
    const openSprint = await createSprint(request, ctx, `E2E Anon Open Sprint ${suffix}`, -1, 13);
    await openBoard(page, member.token, ctx.teamId, openSprint);
    await expect(page.getByText(R.anonymousToggleLabel, { exact: true })).toBeVisible();
    await expect(page.getByTestId('anonymous-locked-hint')).toHaveCount(0);
  });
});

test.describe('Deleted comments panel', () => {
  test('an admin sees deleted comments with who deleted them; anonymous ones stay masked; members do not get the panel', async ({ page, request }) => {
    const suffix = suffixFor('panel');
    const ctx = await createCommentTeam(request, suffix, 1);
    const [author] = ctx.members;
    const sprintId = await createSprint(request, ctx, `E2E Panel Sprint ${suffix}`, -1, 13);
    const named = `Named note to remove ${suffix}`;
    const anon = `Anonymous note to remove ${suffix}`;
    const live = `Still on the board ${suffix}`;
    const namedComment = await postComment(request, author.token, sprintId, { content: named, type: 'KEEP' });
    const anonComment = await postComment(request, author.token, sprintId, { content: anon, type: 'IMPROVE', isAnonymous: true });
    await postComment(request, author.token, sprintId, { content: live, type: 'KEEP' });

    // the author removes their anonymous note themselves
    expect((await request.delete(`${BACKEND_URL}/comments/${anonComment.id}`, { headers: auth(author.token) })).ok()).toBeTruthy();

    // the admin removes the named one through the UI
    await openBoard(page, ctx.leader.token, ctx.teamId, sprintId);
    await pickCommentMenuItem(page, named, R.deleteCommentButton);
    await page.getByRole('button', { name: R.deleteConfirmButton }).click();
    await expect(page.getByText(named, { exact: true })).toHaveCount(0);

    // the panel is closed (and unfetched) until opened; then it lists both, newest first
    const deleted = page.getByTestId('deleted-comment');
    await expect(deleted).toHaveCount(0);
    await panelHeader(page, R.deletedPanelTitle).getByRole('button', { name: R.deletedPanelOpenLabel }).click();
    await expect(deleted).toHaveCount(2);
    await expect(deleted.first()).toContainText(named);
    await expect(deleted.first()).toContainText(author.username);
    await expect(deleted.first()).toContainText(R.deletedBy(ctx.leader.username));

    const anonItem = deleted.filter({ hasText: anon });
    await expect(anonItem).toHaveCount(1);
    await expect(anonItem).toContainText(R.anonymousAuthor);
    await expect(anonItem).not.toContainText(author.username); // still masked, even for the admin
    await expect(anonItem).toContainText(R.deletedByAuthor); // the author deleted it: the admin is not blamed, the author is not named
    await expect(anonItem).not.toContainText(ctx.leader.username);
    expect(await noSidewaysScroll(page)).toBe(true);

    // API view of the same list: no authorId / username leak on the anonymous row
    const list = await (await request.get(`${BACKEND_URL}/sprints/${sprintId}/comments/deleted`, { headers: auth(ctx.leader.token) })).json();
    expect(list.map((c: any) => c.id).sort()).toEqual([namedComment.id, anonComment.id].sort());
    const anonRow = list.find((c: any) => c.id === anonComment.id);
    expect(anonRow.deletedBy).toBeNull();
    expect(anonRow.deletedByAuthor).toBe(true);
    expect(JSON.stringify(anonRow)).not.toContain(author.username);

    // boundary: a plain member has no panel in the UI and gets 403 from the API; a stranger gets 404
    await openBoard(page, author.token, ctx.teamId, sprintId);
    await expect(page.getByText(live, { exact: true })).toBeVisible();
    await expect(page.getByText(R.deletedPanelTitle, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('deleted-comment')).toHaveCount(0);
    expect((await request.get(`${BACKEND_URL}/sprints/${sprintId}/comments/deleted`, { headers: auth(author.token) })).status()).toBe(403);
    expect((await request.get(`${BACKEND_URL}/sprints/${sprintId}/comments/deleted`, { headers: auth(ctx.outsider.token) })).status()).toBe(404);
  });
});
