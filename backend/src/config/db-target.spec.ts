import { describeDbTarget } from './db-target';

describe('describeDbTarget', () => {
  it('reports host and database only — never credentials or query string', () => {
    const t = describeDbTarget({
      NODE_ENV: 'development',
      APP_ENV: 'development',
      DATABASE_URL: 'postgresql://owner:SuperSecret@ep-dev-pooler.eu-central-1.aws.example.com/appdb?sslmode=require',
    } as NodeJS.ProcessEnv);
    expect(t.host).toBe('ep-dev-pooler.eu-central-1.aws.example.com');
    expect(t.database).toBe('appdb');
    expect(JSON.stringify(t)).not.toContain('SuperSecret');
    expect(JSON.stringify(t)).not.toContain('owner');
    expect(t.warnings).toEqual([]);
  });

  it('warns when a non-production server is not marked as development', () => {
    const t = describeDbTarget({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://u:p@h/db' } as NodeJS.ProcessEnv);
    expect(t.warnings).toHaveLength(1);
    expect(t.warnings[0]).toContain('PRODUCTION database');
  });

  it('treats an unset NODE_ENV as non-production (the local dev server)', () => {
    const t = describeDbTarget({ DATABASE_URL: 'postgresql://u:p@h/db' } as NodeJS.ProcessEnv);
    expect(t.warnings).toHaveLength(1);
  });

  it('is quiet for a normal production process and for Jest', () => {
    expect(describeDbTarget({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@h/db' } as NodeJS.ProcessEnv).warnings).toEqual([]);
    expect(describeDbTarget({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://u:p@h/db' } as NodeJS.ProcessEnv).warnings).toEqual([]);
  });

  it('warns when production is marked development', () => {
    const t = describeDbTarget({ NODE_ENV: 'production', APP_ENV: 'development', DATABASE_URL: 'postgresql://u:p@h/db' } as NodeJS.ProcessEnv);
    expect(t.warnings[0]).toContain('marked as development');
  });

  it('survives a missing or malformed URL', () => {
    expect(describeDbTarget({ NODE_ENV: 'test' } as NodeJS.ProcessEnv).host).toContain('not set');
    expect(describeDbTarget({ NODE_ENV: 'test', DATABASE_URL: 'not a url' } as NodeJS.ProcessEnv).host).toContain('not a valid URL');
  });
});
