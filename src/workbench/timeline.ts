import { timeLimit, type Family } from '../seedbank/recipes.ts';
export function timelineWindow(family: Family, anchor: number, span: number) {
  const limit = timeLimit(family);
  const start = Math.max(0, Math.min(limit - span, Math.floor(anchor / span) * span));
  return { start, end: Math.min(limit, start + span) };
}
export function stepTime(family: Family, time: number, delta: number) {
  return Math.max(0, Math.min(timeLimit(family), Math.round((time + delta) * 1000000) / 1000000));
}
