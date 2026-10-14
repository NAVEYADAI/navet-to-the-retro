import { purgeExpiredSoftDeleted } from './soft-delete-purge';

const DAY = 24 * 60 * 60 * 1000;

describe('purgeExpiredSoftDeleted (feature 14)', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  const make = (teams = 0, sprints = 0) => ({
    team: { deleteMany: jest.fn().mockResolvedValue({ count: teams }) },
    sprint: { deleteMany: jest.fn().mockResolvedValue({ count: sprints }) },
  });

  it('hard-deletes only rows soft-deleted MORE than 30 days ago (strictly older than the cutoff)', async () => {
    const prisma = make(1, 2);

    const result = await purgeExpiredSoftDeleted(prisma as any, now);

    const cutoff = new Date(now.getTime() - 30 * DAY);
    expect(prisma.team.deleteMany).toHaveBeenCalledWith({ where: { deletedAt: { lt: cutoff } } });
    expect(prisma.sprint.deleteMany).toHaveBeenCalledWith({ where: { deletedAt: { lt: cutoff } } });
    expect(result).toEqual({ teams: 1, sprints: 2 });
  });

  it('never touches live rows: the filter requires a non-null deletedAt (an `lt` on null matches nothing)', async () => {
    const prisma = make();
    await purgeExpiredSoftDeleted(prisma as any, now);
    for (const call of [prisma.team.deleteMany.mock.calls[0][0], prisma.sprint.deleteMany.mock.calls[0][0]]) {
      expect(Object.keys(call.where)).toEqual(['deletedAt']);
      expect(Object.keys(call.where.deletedAt)).toEqual(['lt']);
    }
  });

  it('purges teams before sprints, so a team that expires takes its sprints with it through the cascade', async () => {
    const order: string[] = [];
    const prisma = {
      team: { deleteMany: jest.fn().mockImplementation(async () => { order.push('team'); return { count: 0 }; }) },
      sprint: { deleteMany: jest.fn().mockImplementation(async () => { order.push('sprint'); return { count: 0 }; }) },
    };
    await purgeExpiredSoftDeleted(prisma as any, now);
    expect(order).toEqual(['team', 'sprint']);
  });
});
