import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTeamCategoryDto, UpdateTeamCategoryDto } from './dto/team-categories.dto';
import { assertCanManageTeamContent } from '../teams/team-permissions.util';

// Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.1), built
// on the same shape as invites.service.ts (see backend/AGENTS.md's "per-team-owned entities"
// pattern): teamId-scoped resource, soft-disable instead of hard delete, mutation guarded by
// assertCanManageTeamContent (§3.0 decision #2). Unlike invites, *viewing* the list is not
// admin-gated — every team member needs it to populate the comment-writing form's category
// picker, not just the management panel.
@Injectable()
export class TeamCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertIsTeamMember(teamId: number, requesterId: number) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId } }
    });
    if (!membership) {
      throw new ForbiddenException('You do not belong to this team');
    }
  }

  // enabledOnly=false (default) is the management-panel view (needs disabled rows too, so an
  // admin can re-enable them); enabledOnly=true is the comment-writing form's view.
  //
  // sprintIds, when passed, scopes each category's `commentCount` to just those sprints (the
  // settings panel's "how many comments used this category" filter, checkbox-per-sprint,
  // defaulting to all sprints selected — see product-backlog/03-team-comment-categories.md's
  // settings-panel addendum). Omitted entirely -> counts span every sprint on the team, same as
  // no filter applied. The count is informational only for the comment-writing form's callers,
  // who don't request it and can ignore the field.
  async listCategories(teamId: number, requesterId: number, enabledOnly: boolean, sprintIds?: number[]) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    await this.assertIsTeamMember(teamId, requesterId);

    const [categories, counts] = await Promise.all([
      this.prisma.teamCommentCategory.findMany({
        where: { teamId, ...(enabledOnly ? { isEnabled: true } : {}) },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
      }),
      this.prisma.comment.groupBy({
        by: ['categoryId'],
        where: {
          teamId,
          categoryId: { not: null },
          ...(sprintIds ? { sprintId: { in: sprintIds } } : {})
        },
        _count: { _all: true }
      })
    ]);

    const countByCategoryId = new Map(counts.map(c => [c.categoryId as number, c._count._all]));
    return categories.map(cat => ({ ...cat, commentCount: countByCategoryId.get(cat.id) ?? 0 }));
  }

  async createCategory(teamId: number, dto: CreateTeamCategoryDto, requesterId: number) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    await assertCanManageTeamContent(this.prisma, teamId, requesterId);

    const label = dto.label?.trim();
    if (!label) {
      throw new BadRequestException('יש להזין שם קטגוריה');
    }

    return this.prisma.teamCommentCategory.create({
      data: {
        teamId,
        label,
        isDefault: false,
        isEnabled: true,
        createdById: requesterId
      }
    });
  }

  // MVP: toggle isEnabled only — no rename, no hard delete (§3.0 decision #3, "לא בטיפול").
  async updateCategory(teamId: number, categoryId: number, dto: UpdateTeamCategoryDto, requesterId: number) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    await assertCanManageTeamContent(this.prisma, teamId, requesterId);

    const category = await this.prisma.teamCommentCategory.findFirst({ where: { id: categoryId, teamId } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.teamCommentCategory.update({
      where: { id: categoryId },
      data: { isEnabled: dto.isEnabled ?? category.isEnabled }
    });
  }
}
