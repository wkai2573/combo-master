import { describe, expect, it } from 'vitest';
import { feedbackUrlFor, FEEDBACK_FALLBACK_URL } from '../src/stats/config';

describe('問卷網址', () => {
  it('有戰績伺服器時，連伺服器固定的 /feedback（目的網址由伺服器設定決定）', () => {
    expect(feedbackUrlFor('https://records.example.workers.dev')).toBe('https://records.example.workers.dev/feedback');
  });

  it('沒有戰績伺服器（本機開發）時，直接連備用的問卷網址', () => {
    expect(feedbackUrlFor('')).toBe(FEEDBACK_FALLBACK_URL);
    expect(FEEDBACK_FALLBACK_URL.startsWith('https://')).toBe(true);
  });

});
