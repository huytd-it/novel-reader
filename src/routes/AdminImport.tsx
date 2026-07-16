import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  prepareEpub,
  adminImport,
  slugify,
  type PreparedImport,
  type AdminImportResult,
  type ImportChapter,
  type ImportMode,
} from '@/lib/admin';
import {
  assignChapterIndexes,
  detectChapterNumber,
  type AssignedIndex,
} from '@/lib/chapterNumber';
import { AdminGate } from '@/components/admin/AdminGate';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

const PREVIEW_COUNT = 5;

export default function AdminImport() {
  return (
    <AdminGate next="/admin/import">
      <ImportWorkspace />
    </AdminGate>
  );
}

/** Parse "từ/đến chương" — chuỗi rỗng = không giới hạn. */
function parseBound(s: string): number | null {
  const n = Number(s.trim());
  return s.trim() !== '' && Number.isSafeInteger(n) && n >= 1 ? n : null;
}

interface ChapterRow {
  pos: number; // vị trí trong file EPUB
  title: string;
  content: string;
  included: boolean; // còn được tick (chưa bị loại tay)
  assigned: AssignedIndex | null; // null khi bị loại tay
  selected: boolean; // included && nằm trong range → sẽ nhập
}

function ImportWorkspace() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [prepared, setPrepared] = useState<PreparedImport | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Trường cấu hình import.
  const [slug, setSlug] = useState('');
  const [titleOverride, setTitleOverride] = useState('');
  const [authorOverride, setAuthorOverride] = useState('');
  const [free, setFree] = useState(5);
  const [publish, setPublish] = useState(false);
  const [mode, setMode] = useState<ImportMode>('replace');

  // Chọn chương: loại tay (checkbox) + cắt theo range số chương.
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<AdminImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setParseError(null);
    setResult(null);
    setImportError(null);
    try {
      const p = await prepareEpub(file);
      setPrepared(p);
      setFileName(file.name);
      setSlug(slugify(p.parsed.metaTitle));
      setTitleOverride('');
      setAuthorOverride('');
      setFree(5);
      setPublish(false);
      setMode('replace');
      setExcluded(new Set());
      setRangeFrom('');
      setRangeTo('');
    } catch (err) {
      setPrepared(null);
      setParseError(
        err instanceof Error ? err.message : 'Không đọc được file EPUB.',
      );
    } finally {
      setParsing(false);
    }
  }

  const chapters = useMemo(() => prepared?.parsed.chapters ?? [], [prepared]);

  // Đánh số các chương còn tick (ưu tiên số trong tên, thiếu thì nối tiếp),
  // rồi cắt theo range. Bỏ tick chương rác → các chương sau tự đánh lại số.
  const rows: ChapterRow[] = useMemo(() => {
    const includedPos = chapters
      .map((_, i) => i)
      .filter((i) => !excluded.has(i));
    const assigned = assignChapterIndexes(
      includedPos.map((i) => chapters[i].title),
    );
    const byPos = new Map<number, AssignedIndex>();
    includedPos.forEach((pos, k) => byPos.set(pos, assigned[k]));

    const from = parseBound(rangeFrom);
    const to = parseBound(rangeTo);

    return chapters.map((ch, i) => {
      const a = byPos.get(i) ?? null;
      const inRange =
        a !== null &&
        (from === null || a.index >= from) &&
        (to === null || a.index <= to);
      return {
        pos: i,
        title: ch.title,
        content: ch.content,
        included: a !== null,
        assigned: a,
        selected: inRange,
      };
    });
  }, [chapters, excluded, rangeFrom, rangeTo]);

  const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows]);
  const fromTitleCount = selectedRows.filter(
    (r) => r.assigned?.fromTitle,
  ).length;
  const noNumberPositions = useMemo(
    () =>
      chapters
        .map((ch, i) => ({ i, num: detectChapterNumber(ch.title) }))
        .filter((x) => x.num === null)
        .map((x) => x.i),
    [chapters],
  );

  function toggleRow(pos: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(pos)) next.delete(pos);
      else next.add(pos);
      return next;
    });
  }

  async function onImport() {
    if (!prepared || selectedRows.length === 0) return;
    setImporting(true);
    setImportError(null);
    setResult(null);
    try {
      const importChapters: ImportChapter[] = selectedRows.map((r) => ({
        title: r.title,
        content: r.content,
        index: r.assigned!.index,
      }));
      const res = await adminImport({
        slug,
        title: titleOverride.trim() || prepared.parsed.metaTitle,
        author: authorOverride.trim() || prepared.parsed.metaAuthor || undefined,
        free,
        publish,
        mode,
        chapters: importChapters,
        parsed: prepared.parsed,
        coverBase64: prepared.coverBase64,
      });
      setResult(res);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Có lỗi khi nhập truyện.',
      );
    } finally {
      setImporting(false);
    }
  }

  const slugValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  const canImport =
    !!prepared && slugValid && !importing && selectedRows.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
          Quản trị · Nhập truyện
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em] text-ink-strong">
          Nhập truyện từ EPUB
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Chọn một file <code className="font-mono">.epub</code>. Truyện được
          phân tích ngay trong trình duyệt: số chương lấy từ tên chương
          (&ldquo;Chương 10&rdquo; → 10) để nhập từ nhiều nguồn không bị lệch,
          có thể bỏ chương rác và cắt range trước khi ghi vào cơ sở dữ liệu.
        </p>
      </header>

      {/* ---- Chọn file ---- */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".epub,application/epub+zip"
          onChange={onPickFile}
          className="hidden"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="solid" onClick={() => fileRef.current?.click()}>
            Chọn file EPUB
          </Button>
          {fileName && (
            <span className="font-mono text-xs text-ink-muted">{fileName}</span>
          )}
        </div>
        {parsing && <Spinner label="Đang phân tích EPUB…" />}
        {parseError && (
          <p className="mt-3 text-sm text-clay-red">{parseError}</p>
        )}
      </div>

      {prepared && !parsing && (
        <>
          {/* ---- Metadata + cấu hình ---- */}
          <section className="rounded-xl border border-hairline bg-surface p-6">
            <div className="flex gap-5">
              <div className="h-40 w-28 shrink-0 overflow-hidden rounded-md border border-hairline bg-canvas">
                {prepared.coverDataUrl ? (
                  <img
                    src={prepared.coverDataUrl}
                    alt="Ảnh bìa"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-ink-muted">
                    Không có ảnh bìa
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-ink-muted">Tựa gốc</dt>
                  <dd className="truncate text-ink-strong">
                    {prepared.parsed.metaTitle}
                  </dd>
                  <dt className="text-ink-muted">Tác giả gốc</dt>
                  <dd className="truncate">
                    {prepared.parsed.metaAuthor || '—'}
                  </dd>
                  <dt className="text-ink-muted">Số chương trong file</dt>
                  <dd className="font-mono">{chapters.length}</dd>
                  <dt className="text-ink-muted">Sẽ nhập</dt>
                  <dd className="font-mono">
                    {selectedRows.length}
                    {selectedRows.length > 0 && (
                      <span className="text-ink-muted">
                        {' '}
                        (số {selectedRows[0].assigned!.index} →{' '}
                        {selectedRows[selectedRows.length - 1].assigned!.index})
                      </span>
                    )}
                  </dd>
                </dl>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Slug (URL)" hint={!slugValid ? 'Slug không hợp lệ' : undefined}>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="ten-truyen"
                  className={inputCls(!slugValid)}
                />
              </Field>
              <Field label="Số chương free (index ≤ N)">
                <input
                  type="number"
                  min={0}
                  value={free}
                  onChange={(e) => setFree(Math.max(0, Number(e.target.value)))}
                  className={inputCls(false)}
                />
              </Field>
              <Field label="Ghi đè tựa (tùy chọn)">
                <input
                  value={titleOverride}
                  onChange={(e) => setTitleOverride(e.target.value)}
                  placeholder={prepared.parsed.metaTitle}
                  className={inputCls(false)}
                />
              </Field>
              <Field label="Ghi đè tác giả (tùy chọn)">
                <input
                  value={authorOverride}
                  onChange={(e) => setAuthorOverride(e.target.value)}
                  placeholder={prepared.parsed.metaAuthor || 'Không rõ'}
                  className={inputCls(false)}
                />
              </Field>
              <Field label="Chế độ ghi (khi slug đã tồn tại)">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ImportMode)}
                  className={inputCls(false)}
                >
                  <option value="replace">
                    Thay toàn bộ chương hiện có
                  </option>
                  <option value="merge">
                    Gộp theo số chương (giữ chương hiện có)
                  </option>
                </select>
              </Field>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
                className="h-4 w-4 accent-ink-strong"
              />
              Publish ngay (hiển thị công khai). Bỏ chọn để giữ nháp.
              {mode === 'merge' && (
                <span className="text-xs text-ink-muted">
                  (merge vào truyện có sẵn sẽ giữ nguyên trạng thái publish)
                </span>
              )}
            </label>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                variant="solid"
                disabled={!canImport}
                onClick={() => void onImport()}
              >
                {importing
                  ? 'Đang nhập…'
                  : `Nhập ${selectedRows.length} chương vào DB`}
              </Button>
              {importError && (
                <span className="text-sm text-clay-red">{importError}</span>
              )}
            </div>

            {result && (
              <div className="mt-4 rounded-lg border border-hairline bg-canvas p-4 text-sm">
                <p className="font-medium text-ink-strong">
                  ✓ Đã nhập {result.chapters} chương
                  {result.published ? ' (đã publish)' : ' (nháp)'}.
                </p>
                <p className="mt-1 text-ink-muted">
                  {result.coverUrl ? 'Đã tải ảnh bìa. ' : 'Không có ảnh bìa. '}
                  <Link
                    to={`/truyen/${result.slug}`}
                    className="text-ink underline underline-offset-2"
                  >
                    Xem trang truyện →
                  </Link>{' '}
                  ·{' '}
                  <Link
                    to={`/admin/books/${result.bookId}`}
                    className="text-ink underline underline-offset-2"
                  >
                    Quản lý chương →
                  </Link>
                </p>
              </div>
            )}
          </section>

          {/* ---- Chọn chương ---- */}
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-medium text-ink-strong">
                  Chọn chương ({selectedRows.length}/{chapters.length})
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  {fromTitleCount} chương lấy số từ tên ·{' '}
                  {selectedRows.length - fromTitleCount} chương tự đánh số ·{' '}
                  {noNumberPositions.length} chương không có số trong tên
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="hairline"
                  onClick={() => setExcluded(new Set())}
                >
                  Chọn tất cả
                </Button>
                <Button
                  variant="hairline"
                  disabled={noNumberPositions.length === 0}
                  onClick={() =>
                    setExcluded(
                      (prev) => new Set([...prev, ...noNumberPositions]),
                    )
                  }
                >
                  Bỏ chương không có số
                </Button>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-ink-muted">Range số chương:</span>
              <input
                type="number"
                min={1}
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                placeholder="Từ"
                className={`w-24 ${inputCls(false)}`}
              />
              <span className="text-ink-muted">→</span>
              <input
                type="number"
                min={1}
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                placeholder="Đến"
                className={`w-24 ${inputCls(false)}`}
              />
              {(rangeFrom || rangeTo) && (
                <button
                  className="text-xs text-ink underline underline-offset-2"
                  onClick={() => {
                    setRangeFrom('');
                    setRangeTo('');
                  }}
                >
                  Xoá range
                </button>
              )}
            </div>

            <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-hairline bg-surface">
              {rows.map((row) => (
                <label
                  key={row.pos}
                  className={`flex cursor-pointer items-center gap-3 border-b border-hairline px-4 py-2 text-sm last:border-0 ${
                    row.selected ? '' : 'opacity-45'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={row.included}
                    onChange={() => toggleRow(row.pos)}
                    className="h-4 w-4 shrink-0 accent-ink-strong"
                  />
                  <span className="w-14 shrink-0 text-right font-mono text-xs text-ink-muted">
                    {row.assigned ? `#${row.assigned.index}` : '—'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink-strong">
                    {row.title}
                  </span>
                  {row.assigned && !row.assigned.fromTitle && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] ${
                        row.assigned.conflict
                          ? 'bg-pale-red text-clay-red'
                          : 'bg-pale-yellow text-clay-yellow'
                      }`}
                    >
                      {row.assigned.conflict ? 'Số trùng/lùi' : 'Tự đánh số'}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              &ldquo;Tự đánh số&rdquo; = tên chương không có số, dùng số chương
              đứng trước + 1. Bỏ tick chương rác (giới thiệu, thông báo nghỉ…)
              để các chương sau khớp lại số trong tên.
            </p>
          </section>

          {/* ---- Xem trước nội dung ---- */}
          <section>
            <h2 className="mb-3 font-display text-lg font-medium text-ink-strong">
              Xem trước {Math.min(PREVIEW_COUNT, selectedRows.length)} chương
              đầu sẽ nhập
            </h2>
            <div className="flex flex-col gap-3">
              {selectedRows.slice(0, PREVIEW_COUNT).map((row) => (
                <ChapterPreview
                  key={row.pos}
                  index={row.assigned!.index}
                  title={row.title}
                  content={row.content}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ChapterPreview({
  index,
  title,
  content,
}: {
  index: number;
  title: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  const paragraphs = useMemo(
    () => content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    [content],
  );
  const shown = open ? paragraphs : paragraphs.slice(0, 3);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-lg border border-hairline bg-surface p-4"
    >
      <summary className="cursor-pointer list-none">
        <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">
          Chương {index}
        </span>
        <span className="ml-2 font-medium text-ink-strong">{title}</span>
        <span className="ml-2 font-mono text-xs text-ink-muted">
          · {paragraphs.length} đoạn
        </span>
      </summary>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
        {shown.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {!open && paragraphs.length > 3 && (
          <p className="text-ink-muted">… (mở để xem đầy đủ)</p>
        )}
      </div>
    </details>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-clay-red">{hint}</span>}
    </label>
  );
}

function inputCls(invalid: boolean): string {
  return `rounded-md border bg-canvas px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink ${
    invalid ? 'border-clay-red' : 'border-hairline'
  }`;
}
