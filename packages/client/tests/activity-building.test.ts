import { describe, expect, it } from 'vitest';
import { DEFAULT_MAPPING, homeBuildingForTheme } from '@agent-hollow/shared';
import { activityBuildingForAction, activityBuildingForHero } from '../src/game/home-building';

describe('activity building attribution', () => {
  it('keeps working sessions on their mapped tool building', () => {
    expect(activityBuildingForHero('fantasy', {
      state: 'working',
      currentTool: 'Read',
      projectName: 'agent-hollow',
      projectDir: '/repo/agent-hollow',
    }, DEFAULT_MAPPING)).toBe('library');
  });

  it('sends awaiting-input sessions to the theme waiting building', () => {
    expect(activityBuildingForHero('fantasy', {
      state: 'awaiting-input',
      projectName: 'agent-hollow',
      projectDir: '/repo/agent-hollow',
    }, DEFAULT_MAPPING)).toBe('shrine');
  });

  it('routes idle and sleeping sessions to a stable social home', () => {
    expect(activityBuildingForHero('fantasy', {
      state: 'idle',
      sessionId: 'session-a',
      projectName: 'agent-hollow',
      projectDir: '/repo/agent-hollow',
    }, DEFAULT_MAPPING)).toBe(homeBuildingForTheme('fantasy', {
      sessionId: 'session-a',
      projectName: 'agent-hollow',
      projectDir: '/repo/agent-hollow',
    }));
    expect(activityBuildingForHero('fantasy', {
      state: 'sleeping',
      sessionId: 'session-a',
      projectName: 'agent-hollow',
      projectDir: '/repo/agent-hollow',
    }, DEFAULT_MAPPING)).toBe(homeBuildingForTheme('fantasy', {
      sessionId: 'session-a',
      projectName: 'agent-hollow',
      projectDir: '/repo/agent-hollow',
    }));
  });

  it('distributes home buildings by session within the same project', () => {
    expect(homeBuildingForTheme('scifi', {
      sessionId: 'session-a',
      projectName: 'agent-hollow',
      projectDir: '/repo/agent-hollow',
    })).toBe('hydroponics');
    expect(homeBuildingForTheme('scifi', {
      sessionId: 'session-b',
      projectName: 'agent-hollow',
      projectDir: '/repo/agent-hollow',
    })).toBe('lounge');
  });

  it('routes returning sessions to the completed social building', () => {
    expect(activityBuildingForHero('fantasy', {
      state: 'returning',
      projectName: 'agent-hollow',
      projectDir: '/repo/agent-hollow',
    }, DEFAULT_MAPPING)).toBe('garden');
    expect(activityBuildingForHero('scifi', {
      state: 'returning',
      projectName: 'agent-hollow',
      projectDir: '/repo/agent-hollow',
    }, DEFAULT_MAPPING)).toBe('hydroponics');
  });

  it('routes recovering sessions to the recovery social building', () => {
    expect(activityBuildingForHero('fantasy', {
      state: 'recovering',
      projectName: 'agent-hollow',
      projectDir: '/repo/agent-hollow',
    }, DEFAULT_MAPPING)).toBe('shrine');
    expect(activityBuildingForHero('scifi', {
      state: 'recovering',
      projectName: 'agent-hollow',
      projectDir: '/repo/agent-hollow',
    }, DEFAULT_MAPPING)).toBe('medbay');
  });

  it('assigns completed action entries to theme resting buildings', () => {
    expect(activityBuildingForAction({ kind: 'completed', projectName: 'agent-hollow', projectDir: '/repo/agent-hollow' }, 'fantasy', DEFAULT_MAPPING)).toBe('garden');
    expect(activityBuildingForAction({ kind: 'completed', projectName: 'agent-hollow', projectDir: '/repo/agent-hollow' }, 'scifi', DEFAULT_MAPPING)).toBe('hydroponics');
  });
});
