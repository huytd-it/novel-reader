import { useMemo } from 'react';

interface ReaderPaneProps {
  title: string;
  index: number;
  content: string; // plain text, đoạn tách bằng \n\n
}

/**
 * Khối text chính. Nội dung plain text → tách đoạn theo \n\n.
 * `content-visibility: auto` trên từng <p> (đặt trong .reader-prose)
 * để chương dài vẫn cuộn mượt mà không cần virtualize.
 */
export function ReaderPane({ title, index, content }: ReaderPaneProps) {
  const paragraphs = useMemo(
    () =>
      content
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
    [content],
  );

  return (
    <article className="reader-prose px-5 pb-24 pt-8 sm:px-0">
      <header className="mb-10">
        <p className="mb-2 font-sans text-xs font-medium uppercase tracking-[0.18em] text-muted">
          Chương {index}
        </p>
        <h1 className="font-serif text-2xl font-medium leading-snug">
          {title}
        </h1>
        <div className="mt-6 h-px w-10 bg-border" aria-hidden />
      </header>

      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </article>
  );
}
