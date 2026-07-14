import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  prepareEpub,
  adminImport,
  slugify,
  type PreparedImport,
  type AdminImportResult,
} from '@/lib/admin';
import { AdminGate } from '@/components/admin/AdminGate';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

const PREVIEW_COUNT = 10;

export default function AdminImport() {
  return (
    <AdminGate next="/admin/import">
      <ImportWorkspace />
    </AdminGate>
  );
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
    } catch (err) {
      setPrepared(null);
      setParseError(
        err instanceof Error ? err.message : 'Không đọc được file EPUB.',
      );
    } finally {
      setParsing(false);
    }
  }

  async function onImport() {
    if (!prepared) return;
    setImporting(true);
    setImportError(null);
    setResult(null);
    try {
      const res = await adminImport({
        slug,
        title: titleOverride.trim() || prepared.parsed.metaTitle,
        author: authorOverride.trim() || prepared.parsed.metaAuthor || undefined,
        free,
        publish,
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

  const chapters = useMemo(
    () => prepared?.parsed.chapters ?? [],
    [prepared],
  );
  const previewChapters = useMemo(
    () => chapters.slice(0, PREVIEW_COUNT),
    [chapters],
  );

  const slugValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  const canImport = !!prepared && slugValid && !importing;

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
          phân tích ngay trong trình duyệt để xem trước {PREVIEW_COUNT} chương
          đầu, sau đó mới ghi vào cơ sở dữ liệu.
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
                  <dt className="text-ink-muted">Số chương</dt>
                  <dd className="font-mono">{chapters.length}</dd>
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
              <Field label="Số chương free">
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
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
                className="h-4 w-4 accent-ink-strong"
              />
              Publish ngay (hiển thị công khai). Bỏ chọn để giữ nháp.
            </label>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                variant="solid"
                disabled={!canImport}
                onClick={() => void onImport()}
              >
                {importing
                  ? 'Đang nhập…'
                  : `Nhập ${chapters.length} chương vào DB`}
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
                  </Link>
                </p>
              </div>
            )}
          </section>

          {/* ---- Xem trước 10 chương đầu ---- */}
          <section>
            <h2 className="mb-3 font-display text-lg font-medium text-ink-strong">
              Xem trước {Math.min(PREVIEW_COUNT, chapters.length)} chương đầu
            </h2>
            <div className="flex flex-col gap-3">
              {previewChapters.map((ch, i) => (
                <ChapterPreview key={i} index={i + 1} title={ch.title} content={ch.content} />
              ))}
            </div>
            {chapters.length > PREVIEW_COUNT && (
              <p className="mt-3 text-sm text-ink-muted">
                … và {chapters.length - PREVIEW_COUNT} chương nữa sẽ được nhập
                cùng.
              </p>
            )}
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
