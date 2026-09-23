import { validateRecipe, type Recipe } from '../seedbank/recipes.ts';
export type RecipeHistory = { past: Recipe[]; present: Recipe; future: Recipe[] };
export function editRecipe(history: RecipeHistory, input: Recipe, grouped = false): RecipeHistory {
  const next = validateRecipe(input);
  if (JSON.stringify(next) === JSON.stringify(history.present)) return history;
  return { past: grouped ? history.past : [...history.past, history.present].slice(-80), present: next, future: [] };
}
export function travelRecipe(history: RecipeHistory, direction: 'undo' | 'redo'): RecipeHistory {
  if (direction === 'undo') {
    if (!history.past.length) return history;
    return { past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future] };
  }
  if (!history.future.length) return history;
  return { past: [...history.past, history.present].slice(-80), present: history.future[0], future: history.future.slice(1) };
}
