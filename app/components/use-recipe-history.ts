'use client';
import { useCallback, useRef, useState, type SetStateAction } from 'react';
import { editRecipe, travelRecipe, type RecipeHistory } from '../../src/workbench/history';
import type { Recipe } from '../../src/seedbank/recipes';

export function useRecipeHistory(initial: Recipe) {
  const [history, update] = useState<RecipeHistory>({ past: [], present: initial, future: [] });
  const live = useRef(history);
  const gesture = useRef<'idle' | 'started' | 'recorded'>('idle');
  const begin = useCallback(() => { gesture.current = 'started'; }, []);
  const end = useCallback(() => { gesture.current = 'idle'; }, []);
  const setRecipe = useCallback((input: SetStateAction<Recipe>) => {
    const next = typeof input === 'function' ? input(live.current.present) : input;
    const changed = editRecipe(live.current, next, gesture.current === 'recorded');
    if (changed !== live.current && gesture.current === 'started') gesture.current = 'recorded';
    live.current = changed; update(changed);
  }, []);
  const travel = useCallback((direction: 'undo' | 'redo') => {
    gesture.current = 'idle';
    live.current = travelRecipe(live.current, direction); update(live.current);
  }, []);
  /** Replace the present recipe without an undo entry (initial load or a shared link). */
  const reset = useCallback((recipe: Recipe) => { gesture.current = 'idle'; live.current = { past: [], present: recipe, future: [] }; update(live.current); }, []);
  return { recipe: history.present, setRecipe, begin, end, reset, undo: () => travel('undo'), redo: () => travel('redo'), canUndo: !!history.past.length, canRedo: !!history.future.length };
}
