import { parseRecipe, serializeRecipe, type Recipe } from '../seedbank/recipes.ts';

/** Share links carry the complete validated recipe in the URL fragment, so the
 * link works without a server and nothing is sent anywhere. */
export function encodeRecipe(recipe: Recipe) {
  const json = JSON.stringify(JSON.parse(serializeRecipe(recipe)));
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeRecipe(token: string): Recipe {
  if (!/^[A-Za-z0-9_-]{1,22000}$/.test(token)) throw new Error('This link does not contain a readable recipe.');
  const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return parseRecipe(new TextDecoder().decode(bytes));
}
export const recipeHash = (recipe: Recipe) => `#r=${encodeRecipe(recipe)}`;
/** Reads `#r=…` from a location hash; returns null when absent. Throws on a damaged token. */
export function recipeFromHash(hash: string): Recipe | null {
  const match = /^#r=(.*)$/.exec(hash);
  return match ? decodeRecipe(match[1]) : null;
}
