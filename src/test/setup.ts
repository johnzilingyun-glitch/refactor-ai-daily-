import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock global fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({}),
  text: async () => '',
  status: 200,
});

// Mock process.env
process.env.GEMINI_API_KEY = 'test-api-key';
