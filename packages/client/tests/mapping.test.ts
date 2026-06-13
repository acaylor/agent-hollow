import { describe, it, expect } from 'vitest';
import { toolToBuilding } from '../src/theme/mapping';

describe('toolToBuilding', () => {
  it('mapuje narzędzia na właściwe budynki (metafora gry)', () => {
    expect(toolToBuilding('Edit')).toBe('forge');
    expect(toolToBuilding('Write')).toBe('forge');
    expect(toolToBuilding('Read')).toBe('library');
    expect(toolToBuilding('Grep')).toBe('library');
    expect(toolToBuilding('Bash')).toBe('mine');
    expect(toolToBuilding('Task')).toBe('barracks');
    expect(toolToBuilding('WebSearch')).toBe('tower');
  });

  it('narzędzia subagentów: StructuredOutput→koszary, ToolSearch→biblioteka, KillShell→kopalnia', () => {
    expect(toolToBuilding('StructuredOutput')).toBe('barracks');
    expect(toolToBuilding('ToolSearch')).toBe('library');
    expect(toolToBuilding('KillShell')).toBe('mine');
  });

  it('Bash z poleceniem git → targ (karawana z towarem)', () => {
    expect(toolToBuilding('Bash', 'git commit -m "x"')).toBe('market');
    expect(toolToBuilding('Bash', 'git push origin main')).toBe('market');
  });

  it('Bash bez gita → kopalnia (rozróżnienie GIT_RE)', () => {
    expect(toolToBuilding('Bash', 'ls -la')).toBe('mine');
    expect(toolToBuilding('Bash', 'echo git is mentioned')).toBe('mine');
  });

  it('dowolne narzędzie mcp__ → gildia', () => {
    expect(toolToBuilding('mcp__pixellab__get_balance')).toBe('guild');
    expect(toolToBuilding('mcp__whatever')).toBe('guild');
  });

  it('nieznane narzędzie i brak narzędzia → twierdza (fallback)', () => {
    expect(toolToBuilding('TotallyUnknownTool')).toBe('citadel');
    expect(toolToBuilding(undefined)).toBe('citadel');
  });
});
