/**
 * src/lib/admin.ts
 * Tiện ích cho luồng admin nhập truyện: parse EPUB trong trình duyệt (xem
 * trước) + gọi Edge Function `admin-import` để ghi vào DB.
 */

import { supabase } from './supabase';
import { ApiError } from './api';
import { parseEpubBuffer, type ParsedEpub } from './epub';
import { stripDiacritics } from './text';

// Lưu ý: module này kéo theo jszip + fast-xml-parser (nặng). Chỉ import từ
// route admin (được lazy-load). fetchMyRole cố tình đặt ở api.ts để header/
// guard dùng được mà không kéo parser vào bundle chính.

export interface AdminImportResult {
  bookId: string;
  slug: string;
  chapters: number;
  coverUrl: string | null;
  published: boolean;
}

export interface PreparedImport {
  parsed: ParsedEpub;
  coverDataUrl: string | null; // để xem trước
  coverBase64: string | null; // để gửi lên function
}

/** slug thân thiện URL từ tựa tiếng Việt (bỏ dấu, thay đ→d). */
export function slugify(input: string): string {
  return stripDiacritics(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000; // tránh tràn stack khi spread mảng lớn
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

/** Đọc + parse file .epub ở client, chuẩn bị dữ liệu xem trước & gửi đi. */
export async function prepareEpub(file: File): Promise<PreparedImport> {
  const buf = await file.arrayBuffer();
  const parsed = await parseEpubBuffer(buf);

  let coverBase64: string | null = null;
  let coverDataUrl: string | null = null;
  if (parsed.cover) {
    coverBase64 = bytesToBase64(parsed.cover.data);
    coverDataUrl = `data:${parsed.cover.contentType};base64,${coverBase64}`;
  }
  return { parsed, coverDataUrl, coverBase64 };
}

export interface AdminImportInput {
  slug: string;
  title?: string;
  author?: string;
  free: number;
  publish: boolean;
  parsed: ParsedEpub;
  coverBase64: string | null;
}

/** Gửi truyện đã parse lên Edge Function admin-import (service role ghi DB). */
export async function adminImport(
  input: AdminImportInput,
): Promise<AdminImportResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const payload = {
    slug: input.slug,
    title: input.title,
    author: input.author,
    free: input.free,
    publish: input.publish,
    chapters: input.parsed.chapters,
    cover:
      input.parsed.cover && input.coverBase64
        ? {
            base64: input.coverBase64,
            contentType: input.parsed.cover.contentType,
            ext: input.parsed.cover.ext,
          }
        : null,
  };

  const { data, error } = await supabase.functions.invoke<AdminImportResult>(
    'admin-import',
    {
      body: payload,
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    },
  );

  if (error) {
    const status = extractStatus(error);
    throw new ApiError(status, messageForStatus(status));
  }
  if (!data) throw new ApiError(500, 'Không nhận được kết quả import.');
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
      return 'Bạn cần đăng nhập lại.';
    case 403:
      return 'Tài khoản này không có quyền admin.';
    case 400:
      return 'Dữ liệu truyện không hợp lệ (kiểm tra slug và nội dung).';
    default:
      return 'Có lỗi khi nhập truyện. Xem log function để biết chi tiết.';
  }
}
