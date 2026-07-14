// Kiểu dữ liệu dùng chung, khớp với schema Postgres (0001_init.sql).

export type BookStatus = 'ongoing' | 'completed';

export interface Book {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  description: string | null;
  genre: string[] | null;
  status: BookStatus;
  is_published: boolean;
  chapter_count: number;
  created_at: string;
}

export interface ChapterMeta {
  id: string;
  book_id: string;
  index: number;
  title: string;
  is_free: boolean;
  word_count: number | null;
  created_at: string;
}

/** Payload trả về từ Edge Function `get-chapter`. */
export interface ChapterContent {
  title: string;
  index: number;
  content: string;
  prevIndex: number | null;
  nextIndex: number | null;
}

export interface ReadingProgress {
  user_id: string;
  book_id: string;
  chapter_id: string;
  scroll_pct: number;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  flagged: boolean;
  role: string;
  created_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  chapter_id: string;
  note: string | null;
  created_at: string;
}

/**
 * Bookmark kèm ngữ cảnh chương/truyện (PostgREST embed qua FK
 * bookmarks.chapter_id → chapters, chapters.book_id → books).
 * `book` null khi truyện chưa publish (RLS books) → UI lọc bỏ.
 */
export interface BookmarkWithContext extends Bookmark {
  chapter: {
    id: string;
    index: number;
    title: string;
    book: Pick<Book, 'id' | 'slug' | 'title' | 'cover_url'> | null;
  } | null;
}

/** Một mục trên kệ "Đọc tiếp": reading_progress embed book + chapter. */
export interface ShelfItem extends ReadingProgress {
  book: Book | null; // null khi truyện unpublish → UI lọc bỏ
  chapter: Pick<ChapterMeta, 'id' | 'index' | 'title'> | null;
}

/** Kết quả RPC admin_reads_per_day. */
export interface ReadsPerDay {
  day: string;
  total: number;
  unique_users: number;
}

/** Kết quả RPC admin_reads_per_book. */
export interface ReadsPerBook {
  book_id: string;
  title: string;
  slug: string;
  total: number;
}
