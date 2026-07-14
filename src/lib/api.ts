import { supabase } from './supabase';
import type { Book, ChapterMeta, ChapterContent } from './types';

/** Lỗi có mã HTTP để UI phân biệt 401 / 404 / 429. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---- Library / BookDetail: đọc thẳng qua RLS (dữ liệu công khai) ----

export async function fetchPublishedBooks(genre?: string): Promise<Book[]> {
  let query = supabase
    .from('books')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (genre) query = query.contains('genre', [genre]);

  const { data, error } = await query;
  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

/**
 * Tìm kiếm server-side, không phân biệt dấu (RPC search_books, 0005).
 * SECURITY INVOKER → RLS books tự áp: anon/user chỉ nhận truyện published.
 */
export async function searchBooks(
  q: string,
  limit = 24,
  offset = 0,
): Promise<Book[]> {
  const { data, error } = await supabase.rpc('search_books', {
    p_query: q,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw new ApiError(500, error.message);
  return (data as Book[]) ?? [];
}

export type BookSort = 'moi' | 'danhgia' | 'chuong';

export interface BookFilter {
  genres?: string[];
  status?: 'ongoing' | 'completed';
  minChapters?: number;
  sort?: BookSort;
}

/**
 * Lọc truyện đa tiêu chí (đọc thẳng qua RLS — books published-only).
 * Thể loại: overlaps (khớp bất kỳ thể loại nào đã chọn).
 */
export async function fetchFilteredBooks(filter: BookFilter): Promise<Book[]> {
  let query = supabase.from('books').select('*').eq('is_published', true);

  if (filter.genres && filter.genres.length > 0) {
    query = query.overlaps('genre', filter.genres);
  }
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.minChapters && filter.minChapters > 0) {
    query = query.gte('chapter_count', filter.minChapters);
  }

  switch (filter.sort) {
    case 'danhgia':
      query = query.order('rating_avg', { ascending: false, nullsFirst: false });
      break;
    case 'chuong':
      query = query.order('chapter_count', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

export async function fetchBookBySlug(slug: string): Promise<Book | null> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw new ApiError(500, error.message);
  return data;
}

/** Vai trò của user hiện tại (đọc hàng profiles của chính mình qua RLS). */
export async function fetchMyRole(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return (data?.role as string | undefined) ?? null;
}

export async function fetchChapterList(bookId: string): Promise<ChapterMeta[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('book_id', bookId)
    .order('index', { ascending: true });

  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

// ---- Reader: nội dung chương chỉ qua Edge Function ----

/**
 * Lấy nội dung một chương. Đây là ĐƯỜNG DUY NHẤT lấy nội dung gated.
 * Edge Function tự xác thực JWT (nếu có), rate-limit, log read_events.
 */
export async function fetchChapter(
  bookSlug: string,
  chapterIndex: number,
): Promise<ChapterContent> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data, error } = await supabase.functions.invoke<ChapterContent>(
    'get-chapter',
    {
      body: { bookSlug, chapterIndex },
      // supabase-js tự gắn Authorization từ session nếu đã đăng nhập;
      // ta truyền tường minh để chắc chắn.
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    },
  );

  if (error) {
    // functions.invoke gói lỗi HTTP trong FunctionsHttpError.
    const status = extractStatus(error);
    throw new ApiError(status, messageForStatus(status));
  }
  if (!data) throw new ApiError(500, 'Không nhận được nội dung chương.');
  return data;
}

interface MaybeHttpError {
  context?: { status?: number };
  status?: number;
}

function extractStatus(error: unknown): number {
  const e = error as MaybeHttpError;
  return e?.context?.status ?? e?.status ?? 500;
}

function messageForStatus(status: number): string {
  switch (status) {
    case 401:
      return 'Chương này cần đăng nhập để đọc.';
    case 404:
      return 'Không tìm thấy chương.';
    case 429:
      return 'Bạn đang đọc quá nhanh. Nghỉ một chút rồi thử lại nhé.';
    default:
      return 'Có lỗi xảy ra khi tải chương.';
  }
}
