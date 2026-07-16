/**
 * src/lib/adminChapters.ts
 * Quản lý chương cho admin: liệt kê (kể cả truyện nháp), xoá chương rác,
 * re-index hàng loạt. RLS 0010 cho admin thao tác trực tiếp bảng `chapters`;
 * re-index đi qua RPC admin_reindex_chapters (transaction + né unique).
 */

import { supabase } from './supabase';
import { ApiError } from './api';
import type { ChapterMeta } from './types';
import { assignChapterIndexes } from './chapterNumber';

// PostgREST mặc định cắt kết quả ở 1000 dòng/request — truyện dài hơn phải
// phân trang, nếu không kế hoạch re-index sẽ thiếu chương và bị RPC từ chối
// (incomplete_mapping).
const PAGE_SIZE = 1000;

/** Toàn bộ chương của một truyện (kể cả nháp) — cần RLS admin (0010). */
export async function fetchChaptersForAdmin(
  bookId: string,
): Promise<ChapterMeta[]> {
  const out: ChapterMeta[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', bookId)
      .order('index', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new ApiError(500, error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return out;
}

/** Đếm lại số chương thực tế và cập nhật books.chapter_count. */
export async function recountBookChapters(bookId: string): Promise<number> {
  const { count, error } = await supabase
    .from('chapters')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', bookId);
  if (error) throw new ApiError(500, error.message);

  const { error: updateErr } = await supabase
    .from('books')
    .update({ chapter_count: count ?? 0 })
    .eq('id', bookId);
  if (updateErr) throw new ApiError(500, updateErr.message);

  return count ?? 0;
}

/**
 * Xoá các chương đã chọn (chương rác: giới thiệu, thông báo nghỉ…).
 * Cascade xoá luôn nội dung + bookmark + tiến độ trỏ tới các chương này.
 * Trả về số chương còn lại sau khi đếm lại.
 */
export async function deleteChapters(
  bookId: string,
  chapterIds: string[],
): Promise<number> {
  // Xoá theo lô: .in() nhét id vào query string, vài trăm uuid là chạm trần
  // độ dài URL.
  for (let i = 0; i < chapterIds.length; i += 200) {
    const batch = chapterIds.slice(i, i + 200);
    const { error } = await supabase
      .from('chapters')
      .delete()
      .eq('book_id', bookId)
      .in('id', batch);
    if (error) throw new ApiError(500, error.message);
  }

  return recountBookChapters(bookId);
}

export interface ReindexItem {
  id: string;
  index: number;
}

/**
 * Áp bộ index mới cho TOÀN BỘ chương của truyện (RPC, chạy trong một
 * transaction). `items` phải phủ đủ mọi chương, index >= 1 và không trùng.
 */
export async function reindexChapters(
  bookId: string,
  items: ReindexItem[],
): Promise<void> {
  const { error } = await supabase.rpc('admin_reindex_chapters', {
    p_book_id: bookId,
    p_items: items,
  });
  if (error) throw new ApiError(500, reindexErrorMessage(error.message));
}

/** Dịch lỗi từ RPC admin_reindex_chapters sang thông báo hành động được. */
function reindexErrorMessage(raw: string): string {
  if (raw.includes('incomplete_mapping')) {
    return 'Danh sách chương không khớp với DB (có thể vừa có thay đổi khác). Tải lại trang rồi thử lại.';
  }
  if (raw.includes('duplicate_index')) {
    return 'Bộ số mới bị trùng — kiểm tra lại tên chương.';
  }
  if (raw.includes('invalid_index')) {
    return 'Bộ số mới có giá trị không hợp lệ (< 1).';
  }
  if (raw.includes('forbidden')) {
    return 'Tài khoản này không có quyền admin.';
  }
  return raw;
}

/**
 * Kế hoạch re-index "theo tên chương": ưu tiên số trong tên ("Chương 10" →
 * 10), chương không có số thì nối tiếp chương đứng trước. Giữ nguyên thứ tự
 * hiện tại (sắp theo index cũ).
 */
export function planReindexByTitle(chapters: ChapterMeta[]): ReindexItem[] {
  const sorted = [...chapters].sort((a, b) => a.index - b.index);
  const assigned = assignChapterIndexes(sorted.map((c) => c.title));
  return sorted.map((c, i) => ({ id: c.id, index: assigned[i].index }));
}

/** Kế hoạch re-index "tuần tự": đánh lại 1..N theo thứ tự index hiện tại. */
export function planReindexSequential(chapters: ChapterMeta[]): ReindexItem[] {
  return [...chapters]
    .sort((a, b) => a.index - b.index)
    .map((c, i) => ({ id: c.id, index: i + 1 }));
}
