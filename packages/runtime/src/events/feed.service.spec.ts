import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { FeedService } from './feed.service.js';
import { DatabaseService } from '../db/database.service.js';

describe('FeedService', () => {
  let service: FeedService;
  let db: DatabaseService;
  let emitter: EventEmitter2;

  beforeEach(async () => {
    process.env.DB_PATH = ':memory:';

    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [DatabaseService, FeedService],
    }).compile();

    db = module.get<DatabaseService>(DatabaseService);
    db.onModuleInit();

    service = module.get<FeedService>(FeedService);
    emitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => db.onModuleDestroy());

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

    const items = service.findAll();
    expect(items[0].title).toBe('Second');
    expect(items[1].title).toBe('First');
  });

  it('markRead updates the read flag', async () => {
    const item = await service.create({ type: 'info', title: 'Unread' });
    service.markRead(item.id);

    const items = service.findAll();
    const found = items.find((i) => i.id === item.id);
    expect(found?.read).toBe(true);
  });

  it('dismiss removes the item from the DB', async () => {
    const item = await service.create({ type: 'info', title: 'Gone soon' });
    service.dismiss(item.id);

    const items = service.findAll();
    expect(items.find((i) => i.id === item.id)).toBeUndefined();
  });

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await service.create({ type: 'info', title: `Item ${i}` });
    }

    const limited = service.findAll(3);
    expect(limited.length).toBe(3);
  });
});
