import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPublishedBooks } from '@/lib/api';

/**
 * Danh sách thể loại suy ra từ sách đã publish — dùng chung cho chip lọc ở
 * Library và dropdown "Thể loại" trên header (cùng queryKey ['books'] nên
 * react-query gộp request, không gọi mạng thêm).
 */
export function useGenres() {
  const { data: books } = useQuery({
    queryKey: ['books'],
    queryFn: () => fetchPublishedBooks(),
  });

  const genres = useMemo(() => {
    const set = new Set<string>();
    books?.forEach((b) => b.genre?.forEach((g) => set.add(g)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [books]);

  return { genres };
}
