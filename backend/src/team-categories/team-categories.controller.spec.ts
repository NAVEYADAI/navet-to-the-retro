import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { TeamCategoriesController } from './team-categories.controller';
import { IntIdPipe } from '../common/validation';

// BUG-15: path ids go through IntIdPipe (not ParseIntPipe, which lets "99999999999" through to
// Prisma's Int32 column -> 500), and the `sprintIds` query list is validated token by token.
describe('TeamCategoriesController', () => {
  const service = {
    listCategories: jest.fn().mockResolvedValue([]),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
  };
  const auth = { validateToken: jest.fn().mockResolvedValue({ id: 7 }) };
  const controller = new TeamCategoriesController(service as any, auth as any);

  afterEach(() => jest.clearAllMocks());

  describe('sprintIds query', () => {
    it('parses a comma-separated list of ids', async () => {
      await controller.listCategories('Bearer t', 3, undefined, '4, 5,9');

      expect(service.listCategories).toHaveBeenCalledWith(3, 7, false, [4, 5, 9]);
    });

    it('ignores empty tokens and treats an absent/empty param as "no filter"', async () => {
      await controller.listCategories('Bearer t', 3, undefined, '4,,5,');
      expect(service.listCategories).toHaveBeenLastCalledWith(3, 7, false, [4, 5]);

      await controller.listCategories('Bearer t', 3, undefined, '');
      expect(service.listCategories).toHaveBeenLastCalledWith(3, 7, false, undefined);

      await controller.listCategories('Bearer t', 3, undefined, undefined);
      expect(service.listCategories).toHaveBeenLastCalledWith(3, 7, false, undefined);
    });

    it.each(['4,abc', '1.5', '-3', '0', '99999999999', '[1]'])('rejects %p with BadRequestException', async (raw) => {
      await expect(controller.listCategories('Bearer t', 3, undefined, raw)).rejects.toThrow(BadRequestException);
      expect(service.listCategories).not.toHaveBeenCalled();
    });
  });

  describe('path id pipes', () => {
    // Every @Param on this controller must be validated by IntIdPipe.
    const methods = ['listCategories', 'createCategory', 'updateCategory'] as const;

    it.each(methods)('%s uses IntIdPipe for every path param', (method) => {
      const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TeamCategoriesController, method) as Record<
        string,
        { data?: string; pipes: Array<PipeTransform | (new () => PipeTransform)> }
      >;
      // paramtype 5 = @Param(...) in Nest's RouteParamtypes
      const paramEntries = Object.entries(metadata).filter(([key]) => key.startsWith('5:'));

      expect(paramEntries.length).toBeGreaterThan(0);
      for (const [, entry] of paramEntries) {
        expect(entry.pipes).toContain(IntIdPipe);
      }
    });
  });
});
