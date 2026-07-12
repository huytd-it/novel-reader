/** Chuẩn hoá tiếng Việt để so khớp/tìm kiếm: bỏ dấu, đ→d, hạ chữ thường. */
export function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}
