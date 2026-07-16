/**
 * src/lib/chapterNumber.ts
 * Detect số thứ tự chương từ tên chương ("Chương 10: ..." → 10) và đánh số
 * cho cả danh sách. Dùng chung cho luồng import EPUB (đánh index trước khi
 * ghi DB) và re-index hàng loạt ở trang quản lý chương — nhờ đó nhập từ
 * nhiều nguồn khác nhau vẫn khớp số chương, không bị lệch.
 */

import { stripDiacritics } from './text';

/**
 * Lấy số chương từ tên. Hỗ trợ: "Chương 10", "chuong 10:", "Chapter 10",
 * "Chap 10", "Ch.10", "10. Tên chương", "10", "Quyển 2 - Chương 15",
 * "第10章". Trả null nếu không tìm thấy số hợp lệ (>= 1).
 */
export function detectChapterNumber(title: string): number | null {
  const t = stripDiacritics(title).trim();

  // Đầu chuỗi: "chuong 10", "chapter 10", "chap 10", "ch. 10"
  let m = t.match(/^(?:chuong|chapter|chap|ch)\b[.\s]*0*(\d{1,6})\b/);
  // Đầu chuỗi là số: "10: Tên", "10. Tên", "10 - Tên", hoặc chỉ "10"
  if (!m) m = t.match(/^0*(\d{1,6})\s*(?:[.:\-–—)]|$)/);
  // Giữa chuỗi: "quyen 2 - chuong 15" → ưu tiên số đứng sau "chuong"
  if (!m) m = t.match(/\b(?:chuong|chapter|chap)\s*0*(\d{1,6})\b/);
  // Kiểu Trung: 第10章 / 第10回
  if (!m) m = title.match(/第\s*0*(\d{1,6})\s*[章回]/);
  if (!m) return null;

  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

export interface AssignedIndex {
  /** Số thứ tự sẽ dùng làm `chapters.index`. */
  index: number;
  /** true = lấy từ số trong tên chương; false = tự đánh (index tuần tự). */
  fromTitle: boolean;
  /**
   * true = tên chương CÓ số nhưng không dùng được (trùng/thụt lùi so với
   * chương đứng trước) → đã fallback sang tuần tự. UI nên cảnh báo.
   */
  conflict: boolean;
}

/**
 * Đánh số cho danh sách tên chương theo thứ tự xuất hiện.
 * Quy tắc: ưu tiên số trong tên nếu nó tăng so với chương trước; nếu không
 * có số (chương giới thiệu, thông báo…) hoặc số bị trùng/thụt lùi thì dùng
 * số của chương trước + 1.
 */
export function assignChapterIndexes(titles: string[]): AssignedIndex[] {
  const out: AssignedIndex[] = [];
  let prev = 0;
  for (const title of titles) {
    const detected = detectChapterNumber(title);
    if (detected !== null && detected > prev) {
      out.push({ index: detected, fromTitle: true, conflict: false });
      prev = detected;
    } else {
      out.push({
        index: prev + 1,
        fromTitle: false,
        conflict: detected !== null,
      });
      prev = prev + 1;
    }
  }
  return out;
}
