import {
  escapeHtml,
  teamSelectedMessage,
  sprintSelectedMessage,
  askTypeMessage,
  confirmationMessage,
  buildTeamListMessage,
  buildSprintListMessage,
  buildCategoryListMessage,
} from './telegram-messages';

describe('telegram-messages — HTML escaping of dynamic names (BUG-26)', () => {
  it('escapeHtml escapes &, < and > only', () => {
    expect(escapeHtml('a & b <i>c</i>')).toBe('a &amp; b &lt;i&gt;c&lt;/i&gt;');
  });

  it('leaves Markdown-special characters untouched (they are harmless in HTML mode)', () => {
    expect(escapeHtml('dev_ops a*b `x` [y]')).toBe('dev_ops a*b `x` [y]');
  });

  it('escapes names in every message that interpolates one', () => {
    const evil = 'R&D <b>x</b>';
    const escaped = 'R&amp;D &lt;b&gt;x&lt;/b&gt;';
    expect(teamSelectedMessage(evil)).toBe(`✅ <b>${escaped}</b>`);
    expect(sprintSelectedMessage(evil)).toContain(`<b>${escaped}</b>`);
    expect(askTypeMessage(evil, evil)).toContain(`<b>${escaped}</b> · ספרינט <b>${escaped}</b>`);
    expect(confirmationMessage(evil, 'KEEP')).toContain(escaped);
    expect(buildTeamListMessage([{ teamName: evil }])).toContain(`1. ${escaped}`);
    expect(buildSprintListMessage([{ sprintName: evil }])).toContain(`1. ${escaped}`);
    expect(buildCategoryListMessage([{ label: evil }])).toContain(`1. ${escaped}`);
  });

  it('never emits legacy-Markdown bold markers', () => {
    expect(buildTeamListMessage([{ teamName: 'dev_ops' }])).not.toContain('*');
    expect(askTypeMessage('a*b', 'c_d')).not.toMatch(/\*[^*]+\*/);
  });
});
