import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { FeedService } from '../src/events/feed.service';
import { DRIZZLE, type DrizzleDB } from '../src/db';
import * as schema from '../src/db/schema';
import { feedEvents, agents, agentVersions, agentRuns, agentSecrets, userAgentInstalls } from '../src/db/schema';

describe('FeedService', () => {
  let service: FeedService;
  let db: DrizzleDB;
  let emitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
      ],
      providers: [
        {
          provide: DRIZZLE,
          useFactory: () => {
            const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/magically_v2' });
            return drizzle(pool, { schema });
          },
        },
        FeedService,
      ],
    }).compile();

    db = module.get<DrizzleDB>(DRIZZLE);
    await db.delete(userAgentInstalls);
    await db.delete(agentRuns);
    await db.delete(agentSecrets);
    await db.delete(feedEvents);
    await db.delete(agentVersions);
    await db.delete(agents);

    service = module.get<FeedService>(FeedService);
    emitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('creates a feed item and persists to DB', async () => {
    const item = await service.create({
      type: 'success',
      title: 'Agent finished',
      body: 'Calendar Hero researched your 9am meeting',
    });

    expect(item.id).toBeDefined();
    expect(item.type).toBe('success');
    expect(item.read).toBe(false);
  });

  it('emits feed.new event on create', async () => {
    const spy = jest.fn();
    emitter.on('feed.new', spy);

    await service.create({ type: 'info', title: 'Hello' });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].title).toBe('Hello');
  });

  it('findAll returns items newest-first', async () => {
    await service.create({ type: 'info', title: 'First' });
    await new Promise((r) => setTimeout(r, 5));
    await service.create({ type: 'info', title: 'Second' });

    const items = await service.findAll();
    expect(items[0].title).toBe('Second');
    expect(items[1].title).toBe('First');
  });

  it('markRead updates the read flag', async () => {
    const item = await service.create({ type: 'info', title: 'Unread' });
    await service.markRead(item.id);

    const items = await service.findAll();
    const found = items.find((i) => i.id === item.id);
    expect(found?.read).toBe(true);
  });

  it('dismiss removes the item from the DB', async () => {
    const item = await service.create({ type: 'info', title: 'Gone soon' });
    await service.dismiss(item.id);

    const items = await service.findAll();
    expect(items.find((i) => i.id === item.id)).toBeUndefined();
  });

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await service.create({ type: 'info', title: `Item ${i}` });
    }

    const limited = await service.findAll(3);
    expect(limited.length).toBe(3);
  });
});
