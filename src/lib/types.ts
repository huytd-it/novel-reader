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
