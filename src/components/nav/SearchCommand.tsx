import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchBooks } from '@/lib/api';
import {
  clearSearchHistory,
  getSearchHistory,
  pushSearchHistory,
} from '@/lib/searchHistory';
import { SearchIcon } from '@/components/ui/icons';

/**
 * Bảng lệnh tìm kiếm (overlay). Autocomplete có thumbnail + lịch sử gần đây.
 * Mở bằng nút, phím `/` hoặc Ctrl/⌘+K. Đóng bằng Esc / click nền.
 */
export function SearchCommand({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [debounced, setDebounced] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setHistory(getSearchHistory());
  }, []);

  // Debounce 150ms cho autocomplete.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value.trim()), 150);
    return () => clearTimeout(id);
  }, [value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { data: suggestions } = useQuery({
    queryKey: ['search-suggest', debounced],
    queryFn: () => searchBooks(debounced, 6),
    enabled: debounced.length > 0,
    placeholderData: (prev) => prev,
  });

  function runSearch(term: string) {
    const t = term.trim();
    if (!t) return;
    pushSearchHistory(t);
    navigate(`/?q=${encodeURIComponent(t)}`);
    onClose();
  }

  function openBook(slug: string, term: string) {
    if (term.trim()) pushSearchHistory(term.trim());
    navigate(`/truyen/${slug}`);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Tìm truyện"
    >
      <button
        className="absolute inset-0 bg-black/30"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-hairline bg-surface shadow-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(value);
          }}
          className="flex items-center gap-2 border-b border-hairline px-4"
        >
          <SearchIcon width={18} height={18} className="shrink-0 text-ink-muted" />
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Tìm truyện, tác giả…"
            className="w-full bg-transparent py-3.5 text-sm text-ink outline-none"
          />
        </form>

        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {/* Gợi ý theo từ khóa */}
          {debounced && suggestions && suggestions.length > 0 && (
            <ul>
              {suggestions.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => openBook(b.slug, value)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-canvas"
                  >
                    <span className="h-12 w-9 shrink-0 overflow-hidden rounded border border-hairline bg-canvas">
                      {b.cover_url && (
                        <img
                          src={b.cover_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">
                        {b.title}
                      </span>
                      {b.author && (
                        <span className="block truncate text-xs text-ink-muted">
                          {b.author}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {debounced && suggestions && suggestions.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">
              Không có gợi ý. Nhấn Enter để tìm “{debounced}”.
            </p>
          )}

          {/* Lịch sử khi chưa gõ */}
          {!debounced && history.length > 0 && (
            <>
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                  Gần đây
                </span>
                <button
                  className="text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                  onClick={() => {
                    clearSearchHistory();
                    setHistory([]);
                  }}
                >
                  Xoá
                </button>
              </div>
              <ul>
                {history.map((h) => (
                  <li key={h}>
                    <button
                      onClick={() => runSearch(h)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-canvas"
                    >
                      <SearchIcon
                        width={14}
                        height={14}
                        className="shrink-0 text-ink-muted"
                      />
                      {h}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!debounced && history.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">
              Gõ để tìm truyện. Mẹo: nhấn phím <kbd className="font-mono">/</kbd> để
              mở nhanh.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
