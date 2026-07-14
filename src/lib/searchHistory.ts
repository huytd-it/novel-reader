// Lịch sử tìm kiếm gần đây, lưu localStorage (tối đa 8 từ khóa).

const KEY = 'search-history';
const MAX = 8;

export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function pushSearchHistory(term: string): void {
  const t = term.trim();
  if (!t) return;
  const next = [t, ...getSearchHistory().filter((x) => x !== t)].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearSearchHistory(): void {
  localStorage.removeItem(KEY);
}
