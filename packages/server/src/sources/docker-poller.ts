import { basename } from 'node:path';
import { SessionTracker, DEFAULT_THRESHOLDS } from '../state-machine.js';
import { interpretLine } from '../transcript/parser.js';
import { ContainerTailRegistry } from './docker-tail.js';
import type { ContainerInfo, DockerClient } from './docker-client.js';
import type { World } from '../world.js';

/**
 * DockerPoller — okresowo listuje kontenery i czyta z nich pliki sesji Claude
 * przez `docker exec` (pull). Surowe linie JSONL są identyczne z hostowym Claude,
 * więc reuse `interpretLine`. Wzorowany na OpenCodePoller (poll + offset + tracker).
 */

const POLL_INTERVAL_MS = 2000;
const EXEC_TIMEOUT_MS = 5000;
const BIG_FILE_BYTES = 2 * 1024 * 1024;

// Komendy sh wewnątrz kontenera. `~` rozwija się do HOME usera exec-a (różny obraz
// = różny user) — właściwy wybór. `|| true` w sondzie: pusty wynik glob nie ma być błędem.
const PROBE_CMD = 'ls -1 ~/.claude/projects/*/*.jsonl 2>/dev/null || true';
const LIST_CMD =
  'for f in ~/.claude/projects/*/*.jsonl; do [ -f "$f" ] && printf "%s\\t%s\\n" "$(wc -c < "$f")" "$f"; done';
// `tail -c +N "$file"` przez parametry pozycyjne ($1/$2) — bez interpolacji (anty-iniekcja).
const TAIL_ARGV = (offsetPlus1: number, file: string): string[] => [
  'sh',
  '-c',
  'tail -c +"$1" "$2"',
  'sh',
  String(offsetPlus1),
  file,
];

type ContainerStatus = 'agentic' | 'non-agentic' | 'unreadable';

interface SessionEntry {
  tracker: SessionTracker;
  ended: boolean; // czy zaaplikowano już turn-end po zniknięciu kontenera
}

interface ContainerEntry {
  info: ContainerInfo;
  status?: ContainerStatus; // undefined = jeszcze nie sondowany
  present: boolean; // widziany w ostatnim `docker ps`
  sessions: Map<string, SessionEntry>; // klucz = surowy sessionId (uuid)
}

export class DockerPoller {
  private known = new Map<string, ContainerEntry>(); // klucz = container id
  private tails = new ContainerTailRegistry();
  private timer?: NodeJS.Timeout;
  private running = false;
  private loggedUnavailable = false;

  constructor(
    private readonly world: World,
    private readonly client: DockerClient,
    private readonly intervalMs: number = POLL_INTERVAL_MS,
  ) {}

  async start(): Promise<void> {
    if (this.running) return;
    if (process.env.AGENTCRAFT_DOCKER === '0') {
      console.log('[Docker] Poller wyłączony (AGENTCRAFT_DOCKER=0)');
      return;
    }
    this.running = true;
    if (await this.client.available()) {
      console.log('[Docker] Poller started');
    } else {
      console.log('[Docker] docker niedostępny — poller czeka (uruchom Docker, by zobaczyć kontenery)');
    }
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
    await this.poll();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** Publiczne dla testów — jeden cykl pollingu. */
  async poll(): Promise<void> {
    if (!this.running) return;

    let list: ContainerInfo[];
    try {
      list = await this.client.ps();
      this.loggedUnavailable = false;
    } catch (err) {
      // Daemon padł / docker zniknął z PATH — loguj raz, pętla sama się podniesie.
      if (!this.loggedUnavailable) {
        console.warn('[Docker] ps nieosiągalny:', err instanceof Error ? err.message : String(err));
        this.loggedUnavailable = true;
      }
      return;
    }

    const liveIds = new Set(list.map((c) => c.id));
    for (const entry of this.known.values()) entry.present = false;
    for (const info of list) {
      const entry = this.known.get(info.id);
      if (entry) {
        entry.present = true;
        entry.info = info;
      } else {
        this.known.set(info.id, { info, present: true, sessions: new Map() });
      }
    }

    for (const entry of this.known.values()) {
      if (!entry.present) continue;
      if (entry.status === undefined) await this.probe(entry); // sonda raz na ID
      if (entry.status === 'agentic') await this.readContainer(entry);
    }

    this.sweep(liveIds);
  }

  /** Sonda raz na życie kontenera: czy ma ~/.claude/projects. Wynik cache'owany w status. */
  private async probe(entry: ContainerEntry): Promise<void> {
    const r = await this.client.exec(entry.info.id, ['sh', '-c', PROBE_CMD], { timeoutMs: EXEC_TIMEOUT_MS });
    if (r.code !== 0) {
      entry.status = 'unreadable';
      console.warn(`[Docker] kontener ${entry.info.name} nieczytelny (brak sh/uprawnień?) — pomijam`);
      return;
    }
    entry.status = r.stdout.trim().length > 0 ? 'agentic' : 'non-agentic';
  }

  private async readContainer(entry: ContainerEntry): Promise<void> {
    const r = await this.client.exec(entry.info.id, ['sh', '-c', LIST_CMD], { timeoutMs: EXEC_TIMEOUT_MS });
    if (r.code !== 0) return;
    for (const raw of r.stdout.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      const size = Number(line.slice(0, tab));
      const file = line.slice(tab + 1);
      if (!Number.isFinite(size) || !file) continue;
      const sessionId = basename(file, '.jsonl');
      // Dedup: hostowe źródło Claude już śledzi ten UUID (współdzielony ~/.claude) → host wygrywa.
      if (this.world.getHero(sessionId)) continue;
      await this.readFile(entry, sessionId, file, size);
    }
  }

  private async readFile(entry: ContainerEntry, sessionId: string, file: string, size: number): Promise<void> {
    const key = ContainerTailRegistry.key(entry.info.id, file);
    let sess = entry.sessions.get(sessionId);
    if (!sess) {
      const heroId = `docker:${entry.info.id}:${sessionId}`;
      const tracker = new SessionTracker(
        this.world,
        heroId,
        `docker://${entry.info.name}`,
        DEFAULT_THRESHOLDS,
        'claude',
        { container: { id: entry.info.id, name: entry.info.name, image: entry.info.image } },
      );
      sess = { tracker, ended: false };
      entry.sessions.set(sessionId, sess);
      if (size > BIG_FILE_BYTES) this.tails.registerAtEnd(key, size); // pomiń historię dużych plików
    }

    const offset = this.tails.getOffset(key);
    if (size <= offset) return; // brak przyrostu

    const exec = await this.client.exec(entry.info.id, TAIL_ARGV(offset + 1, file), { timeoutMs: EXEC_TIMEOUT_MS });
    if (exec.code !== 0) return;

    for (const l of this.tails.feed(key, size, exec.stdout)) {
      for (const fact of interpretLine(l)) sess.tracker.apply(fact);
    }
    sess.ended = false;
  }

  private sweep(liveIds: Set<string>): void {
    const now = Date.now();
    for (const [id, entry] of this.known) {
      if (!liveIds.has(id)) {
        // Kontener zniknął → zakończ tury jego sesji (raz); dalej starzeją się normalnie.
        for (const sess of entry.sessions.values()) {
          if (!sess.ended) {
            sess.tracker.apply({ kind: 'turn-end', ts: new Date(now).toISOString() });
            sess.ended = true;
          }
        }
      }
      for (const [sid, sess] of entry.sessions) {
        if (sess.tracker.tick(now) === 'remove') entry.sessions.delete(sid);
      }
      if (!liveIds.has(id) && entry.sessions.size === 0) this.known.delete(id);
    }
  }
}
