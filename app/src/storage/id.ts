// Small, dependency-free unique-id generator. Good enough for local row keys
// (single user, single device) without pulling in a uuid/crypto polyfill.
let counter = 0;
export function newId(prefix = 'id'): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}_${counter}`;
}
