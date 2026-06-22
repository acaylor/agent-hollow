import { describe, expect, it } from 'vitest';
import { parseOllamaContextWindow, teeOllamaChat } from '../src/proxy/ollama-logger.js';

describe('parseOllamaContextWindow', () => {
  it('reads the *.context_length key from model_info', () => {
    const show = { model_info: { 'llama.context_length': 8192, 'general.architecture': 'llama' } };
    expect(parseOllamaContextWindow(show)).toBe(8192);
  });
  it('returns undefined when absent', () => {
    expect(parseOllamaContextWindow({})).toBeUndefined();
    expect(parseOllamaContextWindow(null)).toBeUndefined();
  });
});

describe('teeOllamaChat', () => {
  it('logs new request messages, the accumulated assistant reply, usage, and turn_complete', () => {
    const reqMessages = [
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hello' },
    ];
    const ndjson = [
      JSON.stringify({ message: { role: 'assistant', content: 'hi' }, done: false }),
      JSON.stringify({ message: { role: 'assistant', content: ' there' }, done: false }),
      JSON.stringify({ message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: 12, eval_count: 4 }),
    ];
    const records = teeOllamaChat(reqMessages, ndjson);
    expect(records).toContainEqual(expect.objectContaining({ type: 'message', role: 'user', content: 'hello' }));
    expect(records).toContainEqual(expect.objectContaining({ type: 'message', role: 'assistant', content: 'hi there' }));
    expect(records).toContainEqual(expect.objectContaining({ type: 'usage', input: 12, output: 4 }));
    expect(records).toContainEqual(expect.objectContaining({ type: 'turn_complete' }));
  });

  it('captures tool calls from the final assistant message', () => {
    const ndjson = [
      JSON.stringify({
        message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'shell', arguments: { command: 'ls' } } }] },
        done: true,
        prompt_eval_count: 1,
        eval_count: 1,
      }),
    ];
    const records = teeOllamaChat([{ role: 'user', content: 'run ls' }], ndjson);
    const assistant = records.find((r) => r.type === 'message' && r.role === 'assistant') as any;
    expect(assistant.tool_calls?.[0]?.function?.name).toBe('shell');
  });
});
