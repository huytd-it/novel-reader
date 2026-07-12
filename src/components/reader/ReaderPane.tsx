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
    <article className="reader-prose px-5 pb-24 pt-6 sm:px-0">
      <header className="mb-6">
        <p className="mb-1 font-sans text-xs uppercase tracking-wide text-muted">
          Chương {index}
        </p>
        <h1 className="font-serif text-xl font-medium leading-snug">{title}</h1>
      </header>

      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </article>
  );
}
