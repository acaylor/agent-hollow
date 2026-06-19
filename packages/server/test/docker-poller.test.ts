import { describe, expect, it } from 'vitest';
import { World } from '../src/world.js';
import { SessionTracker } from '../src/state-machine.js';
import { DockerPoller } from '../src/sources/docker-poller.js';
import type { ContainerInfo, DockerClient, ExecResult } from '../src/sources/docker-client.js';

describe('SessionTracker — extra (container)', () => {
  it('domieszuje pole container do bohatera i zachowuje je przy kolejnych patchach', () => {
    const world = new World();
    const container = { id: 'abc123', name: 'devbox', image: 'node:20' };
    const tracker = new SessionTracker(world, 'docker:abc123:s1', 'docker://devbox', undefined, 'claude', { container });

    tracker.apply({ kind: 'prompt', text: 'Dodaj endpoint /health', ts: '2026-06-20T10:00:00.000Z' });
    expect(world.getHero('docker:abc123:s1')?.container).toEqual(container);

    // Kolejny patch (np. zmiana stanu) nie gubi container.
    tracker.apply({ kind: 'meta', cwd: '/workspace/app', ts: '2026-06-20T10:00:01.000Z' });
    expect(world.getHero('docker:abc123:s1')?.container).toEqual(container);
    expect(world.getHero('docker:abc123:s1')?.workingDir).toBe('/workspace/app');
  });
});

/** Fake: kontenery + ich pliki (ścieżka → treść). Routuje exec po treści skryptu sh. */
class FakeDockerClient implements DockerClient {
  constructor(
    public up = true,
    public containers: ContainerInfo[] = [],
    public files: Record<string, Record<string, string>> = {}, // id → { path: content }
  ) {}
  async available(): Promise<boolean> {
    return this.up;
  }
  async ps(): Promise<ContainerInfo[]> {
    if (!this.up) throw new Error('docker daemon not running');
    return this.containers;
  }
  async exec(id: string, argv: string[]): Promise<ExecResult> {
    const script = argv[2] ?? '';
    const fs = this.files[id] ?? {};
    if (script.includes('ls -1')) {
      const list = Object.keys(fs).join('\n');
      return { code: 0, stdout: list ? list + '\n' : '', stderr: '' };
    }
    if (script.startsWith('for f in')) {
      const out = Object.entries(fs)
        .map(([f, c]) => `${Buffer.byteLength(c)}\t${f}`)
        .join('\n');
      return { code: 0, stdout: out ? out + '\n' : '', stderr: '' };
    }
    if (script.startsWith('tail')) {
      const offset = Number(argv[4]); // 1-based
      const file = argv[5];
      const content = fs[file] ?? '';
      return { code: 0, stdout: content.slice(offset - 1), stderr: '' };
    }
    return { code: 127, stdout: '', stderr: 'unknown command' };
  }
}

const FILE = '/root/.claude/projects/proj/sess-1.jsonl';
const promptLine =
  JSON.stringify({
    type: 'queue-operation',
    operation: 'enqueue',
    timestamp: '2026-06-20T10:00:00.000Z',
    sessionId: 'sess-1',
    content: 'Napraw testy auth',
  }) + '\n';

describe('DockerPoller', () => {
  it('odkrywa agentowy kontener i rodzi bohatera z polem container + tytułem z promptu', async () => {
    const world = new World();
    const client = new FakeDockerClient(true, [{ id: 'abc123', name: 'devbox', image: 'node:20' }], {
      abc123: { [FILE]: promptLine },
    });
    const poller = new DockerPoller(world, client, 999_999);
    await poller.start();
    poller.stop();

    const hero = world.getHero('docker:abc123:sess-1');
    expect(hero).toBeDefined();
    expect(hero?.container).toEqual({ id: 'abc123', name: 'devbox', image: 'node:20' });
    expect(hero?.title).toBe('Napraw testy auth');
    expect(hero?.projectDir).toBe('docker://devbox');
  });

  it('dedup: gdy host już śledzi ten UUID, nie rodzi kontenerowego bohatera', async () => {
    const world = new World();
    // Host-bohater pod surowym UUID (jak źródło Claude na hoście).
    const host = new SessionTracker(world, 'sess-1', '/host/proj', undefined, 'claude');
    host.apply({ kind: 'prompt', text: 'Hostowy', ts: '2026-06-20T09:00:00.000Z' });

    const client = new FakeDockerClient(true, [{ id: 'abc123', name: 'devbox', image: 'node:20' }], {
      abc123: { [FILE]: promptLine },
    });
    const poller = new DockerPoller(world, client, 999_999);
    await poller.start();
    poller.stop();

    expect(world.getHero('docker:abc123:sess-1')).toBeUndefined(); // pominięty
    expect(world.getHero('sess-1')).toBeDefined(); // host zostaje
  });

  it('kontener bez ~/.claude → brak bohatera, sonda nie powtarzana', async () => {
    const world = new World();
    const client = new FakeDockerClient(true, [{ id: 'empty1', name: 'db', image: 'postgres:16' }], { empty1: {} });
    const poller = new DockerPoller(world, client, 999_999);
    await poller.start();
    await poller.poll(); // drugi cykl
    poller.stop();

    expect(world.snapshot().heroes).toHaveLength(0);
  });

  it('start() nie rzuca, gdy docker niedostępny', async () => {
    const world = new World();
    const client = new FakeDockerClient(false);
    const poller = new DockerPoller(world, client, 999_999);
    await expect(poller.start()).resolves.toBeUndefined();
    poller.stop();
    expect(world.snapshot().heroes).toHaveLength(0);
  });

  it('AGENTCRAFT_DOCKER=0 → start() jest no-opem', async () => {
    const prev = process.env.AGENTCRAFT_DOCKER;
    process.env.AGENTCRAFT_DOCKER = '0';
    try {
      const world = new World();
      const client = new FakeDockerClient(true, [{ id: 'abc123', name: 'devbox', image: 'node:20' }], {
        abc123: { [FILE]: promptLine },
      });
      const poller = new DockerPoller(world, client, 999_999);
      await poller.start();
      poller.stop();
      expect(world.snapshot().heroes).toHaveLength(0);
    } finally {
      if (prev === undefined) delete process.env.AGENTCRAFT_DOCKER;
      else process.env.AGENTCRAFT_DOCKER = prev;
    }
  });

  it('przyrostowy odczyt: druga tura doczytuje nowe linie', async () => {
    const world = new World();
    const files = { abc123: { [FILE]: promptLine } };
    const client = new FakeDockerClient(true, [{ id: 'abc123', name: 'devbox', image: 'node:20' }], files);
    const poller = new DockerPoller(world, client, 999_999);
    await poller.start(); // tura 1: prompt

    // Dopisz turn-end do pliku, druga tura ma go skonsumować (stan → returning).
    const endLine =
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-06-20T10:00:05.000Z',
        message: { id: 'm1', model: 'claude-opus-4-8', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Gotowe.' }] },
      }) + '\n';
    files.abc123[FILE] = promptLine + endLine;
    await poller.poll();
    poller.stop();

    expect(world.getHero('docker:abc123:sess-1')?.state).toBe('returning');
  });
});
