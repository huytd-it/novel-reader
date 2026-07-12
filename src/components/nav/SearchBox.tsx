import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from '@/components/ui/IconButton';
import { SearchIcon, CloseIcon } from '@/components/ui/icons';

export function SearchBox() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : '/');
    setOpen(false);
  }

  if (!open) {
    return (
      <IconButton label="Tìm truyện" onClick={() => setOpen(true)}>
        <SearchIcon width={18} height={18} />
      </IconButton>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Tìm truyện, tác giả…"
        className="w-32 rounded-md border border-hairline bg-canvas px-2.5 py-1.5 text-sm text-ink outline-none transition-colors focus:border-ink sm:w-48"
      />
      <IconButton
        label="Đóng tìm kiếm"
        type="button"
        onClick={() => {
          setValue('');
          setOpen(false);
        }}
      >
        <CloseIcon width={16} height={16} />
      </IconButton>
    </form>
  );
}
