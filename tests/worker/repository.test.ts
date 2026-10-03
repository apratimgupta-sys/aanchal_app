import {env,reset} from 'cloudflare:test';
import {beforeEach,afterEach,it,expect} from 'vitest';
import {Repository} from '../../src/worker/repository';
beforeEach(async()=>{await env.DB.exec(env.TEST_SCHEMA.replace(/\n/g,' '));await env.DB.prepare('INSERT INTO services VALUES(1,?)').bind('service').run();});
it('persists setup and ordered entries',async()=>{const repo=new Repository(env.DB);expect(await repo.getSetup(1)).toBeNull();await env.DB.prepare('INSERT INTO office_setup VALUES(1,?,1)').bind('2026-10-01').run();expect((await repo.getSetup(1))?.startDate).toBe('2026-10-01');});
it('rolls back atomic batch on duplicate key',async()=>{await expect(env.DB.batch([env.DB.prepare('INSERT INTO office_revisions VALUES(1,1)'),env.DB.prepare('INSERT INTO offices VALUES(1,?)').bind('duplicate')])).rejects.toThrow();expect(await env.DB.prepare('SELECT * FROM office_revisions').all()).toMatchObject({results:[]});});

afterEach(async()=>{await reset();});
