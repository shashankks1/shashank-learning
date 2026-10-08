/** Short, sortable, collision-resistant ids such as "b_m1x2k9_4f7a". */
export function createId(prefix: string): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${time}_${random}`;
}
