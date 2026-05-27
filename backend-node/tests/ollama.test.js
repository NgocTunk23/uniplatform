describe('ollama.service', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.OLLAMA_JSON_RETRIES;
    delete process.env.MEETING_SUMMARY_CHUNK_CHARS;
  });

  test('summarizes transcript from fenced JSON and strips qwen thinking tags', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: '<think>draft</think>\n```json\n{"summary":" Tóm tắt ","decisions":[" Quyết định "],"tasks":[" Việc làm "],"notes":" Ghi chú "}\n```',
        },
      }),
    });

    const { summarizeMeetingTranscript } = require('../src/services/ollama.service');
    const result = await summarizeMeetingTranscript('Nội dung cuộc họp tiếng Việt', 'Meeting A');

    expect(result).toEqual({
      summary: 'Tóm tắt',
      decisions: ['Quyết định'],
      tasks: ['Việc làm'],
      notes: 'Ghi chú',
      fallback: false,
    });
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:11434/api/chat', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('qwen3:1.7b');
    expect(body.stream).toBe(false);
    expect(body.think).toBe(false);
    expect(body.format).toBe('json');
  });

  test('does not call Ollama for empty transcript', async () => {
    const { summarizeMeetingTranscript } = require('../src/services/ollama.service');
    const result = await summarizeMeetingTranscript('   ', 'Meeting A');

    expect(result.summary).toBe('Không có nội dung transcript để tóm tắt.');
    expect(result.decisions).toEqual([]);
    expect(result.tasks).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('corrects transcript conservatively from JSON response', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: '{"correctedTranscript":"Xin chào nhóm, hôm nay họp dự án.","uncertainSegments":["[không rõ] tên module"],"notes":"Chỉ sửa lỗi dấu câu."}',
        },
      }),
    });

    const { correctMeetingTranscript } = require('../src/services/ollama.service');
    const result = await correctMeetingTranscript('xin chao nhom hom nay hop du an', 'Meeting A');

    expect(result).toEqual({
      correctedTranscript: 'Xin chào nhóm, hôm nay họp dự án.',
      uncertainSegments: ['[không rõ] tên module'],
      notes: 'Chỉ sửa lỗi dấu câu.',
      fallback: false,
    });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('Không thêm quyết định');
    expect(body.messages[0].content).toContain('nói ngọng');
  });

  test('retries invalid JSON and stores fallback summary after retry budget', async () => {
    process.env.OLLAMA_JSON_RETRIES = '1';
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: '<think>draft</think>\nTóm tắt dạng text, không phải JSON.',
        },
      }),
    });

    const { summarizeMeetingTranscript } = require('../src/services/ollama.service');
    const result = await summarizeMeetingTranscript('Nội dung', 'Meeting A');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.fallback).toBe(true);
    expect(result.summary).toContain('Tóm tắt dạng text');
    expect(result.decisions).toEqual([]);
    expect(result.tasks).toEqual([]);
  });

  test('chunks long transcript before merging final summary', async () => {
    process.env.MEETING_SUMMARY_CHUNK_CHARS = '20';
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: '{"summary":"part","decisions":[],"tasks":[],"notes":""}',
        },
      }),
    });

    const { summarizeMeetingTranscript } = require('../src/services/ollama.service');
    await summarizeMeetingTranscript('a'.repeat(60), 'Meeting A');

    expect(global.fetch.mock.calls.length).toBeGreaterThan(1);
  });

  test('surfaces Ollama API errors', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'model not available' }),
    });

    const { summarizeMeetingTranscript } = require('../src/services/ollama.service');

    await expect(summarizeMeetingTranscript('Nội dung', 'Meeting A')).rejects.toThrow('model not available');
  });
});
