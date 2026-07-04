import { afterEach, describe, expect, it, vi } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { World } from '../src/world.js';
import { getOpencodeDbPath } from '../src/sources/opencode.js';

describe('getOpencodeDbPath', () => {
  afterEach(() => {
    delete process.env.XDG_DATA_HOME;
  });

  it('defaults to ~/.local/share on every platform (OpenCode convention)', () => {
    delete process.env.XDG_DATA_HOME;
    expect(getOpencodeDbPath()).toBe(join(homedir(), '.local', 'share', 'opencode', 'opencode.db'));
  });

  it('honors XDG_DATA_HOME when set', () => {
    process.env.XDG_DATA_HOME = '/custom/data';
    expect(getOpencodeDbPath()).toBe(join('/custom/data', 'opencode', 'opencode.db'));
  });

  it('ignores a blank XDG_DATA_HOME', () => {
    process.env.XDG_DATA_HOME = '  ';
    expect(getOpencodeDbPath()).toBe(join(homedir(), '.local', 'share', 'opencode', 'opencode.db'));
  });
});

describe('OpenCodePoller', () => {
  afterEach(() => {
    vi.doUnmock('better-sqlite3');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('does not log started when initial schema mismatch stops the poller', async () => {
    class SchemaMismatchDb {
      prepare(): { all(): never } {
        return {
          all() {
            throw new Error('no such table: session');
          },
        };
      }

      close(): void {}
    }

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.doMock('better-sqlite3', () => ({ default: SchemaMismatchDb }));

    const { OpenCodePoller } = await import('../src/sources/opencode-poller.js');
    const poller = new OpenCodePoller({} as World);

    await poller.start();

    expect(log).not.toHaveBeenCalledWith('[OpenCode] Poller started');
  });
});
