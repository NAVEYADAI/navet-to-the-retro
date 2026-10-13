import {
  canRemoveMember,
  getSuccessorOptions,
  isLastActiveAdmin,
  isLastActiveLeader,
  isLastRealMember,
  isRegularMember,
} from '../membership-rules';

const m = (id: number, over: Record<string, any> = {}) => ({
  id,
  userId: id + 100,
  role: 'DEVELOPER',
  isAdmin: false,
  status: 'ACTIVE',
  user: { username: `u${id}`, firstName: `User${id}`, lastName: '', isPhantom: false },
  ...over,
});

describe('membership-rules (feature 11)', () => {
  const admin = m(1, { isAdmin: true });
  const leader = m(2, { role: 'TEAM_LEADER' });
  const dev = m(3);
  const phantom = m(4, { user: { username: 'p', firstName: 'Ghost', isPhantom: true } });
  const pending = m(5, { status: 'PENDING' });

  it('a regular member is neither admin nor team leader', () => {
    expect(isRegularMember(dev)).toBe(true);
    expect(isRegularMember(phantom)).toBe(true);
    expect(isRegularMember(admin)).toBe(false);
    expect(isRegularMember(leader)).toBe(false);
  });

  it('admins remove anyone but themselves; a non-admin team leader only regular members', () => {
    expect(canRemoveMember(admin, leader)).toBe(true);
    expect(canRemoveMember(admin, admin)).toBe(false);
    expect(canRemoveMember(leader, dev)).toBe(true);
    expect(canRemoveMember(leader, phantom)).toBe(true);
    expect(canRemoveMember(leader, admin)).toBe(false);
    expect(canRemoveMember(leader, m(6, { role: 'TEAM_LEADER' }))).toBe(false);
    expect(canRemoveMember(dev, phantom)).toBe(false);
    expect(canRemoveMember(undefined, dev)).toBe(false);
  });

  it('only ACTIVE admins / leaders count toward "last"', () => {
    const members = [admin, leader, dev, m(7, { isAdmin: true, status: 'PENDING' })];
    expect(isLastActiveAdmin(members, admin)).toBe(true);
    expect(isLastActiveLeader(members, leader)).toBe(true);
    expect(isLastActiveLeader([...members, m(8, { role: 'TEAM_LEADER' })], leader)).toBe(false);
  });

  it('phantoms and pending invitees do not count as real members', () => {
    expect(isLastRealMember([admin, phantom, pending], admin)).toBe(true);
    expect(isLastRealMember([admin, dev], admin)).toBe(false);
  });

  it('successor options are ACTIVE signed-up members other than the leaver', () => {
    expect(getSuccessorOptions([admin, leader, dev, phantom, pending], admin)).toEqual([
      { value: '2', label: 'User2' },
      { value: '3', label: 'User3' },
    ]);
  });

  it('treats a member without a status as ACTIVE (the server default)', () => {
    const { status: _s, ...noStatus } = dev;
    expect(canRemoveMember({ ...admin, status: undefined }, noStatus)).toBe(true);
  });
});
