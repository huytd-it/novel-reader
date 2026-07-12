-- seed.sql — dữ liệu mẫu để chạy thử local (supabase db reset sẽ tự nạp).
-- 1 truyện đã publish, 6 chương: 5 free + 1 gated → dễ kiểm thử RLS.

do $$
declare
  v_book_id uuid;
  v_ch_id uuid;
  i int;
  v_free boolean;
  v_content text;
begin
  insert into books (slug, title, author, description, genre, status, is_published, chapter_count)
  values (
    'thu-nghiem',
    'Truyện Thử Nghiệm',
    'Tác Giả Ẩn Danh',
    'Một truyện mẫu để kiểm thử reader, RLS và rate limit.' || chr(10) ||
    'Chương 1–5 mở tự do; chương 6 trở đi cần đăng nhập.',
    array['Tiên hiệp', 'Huyền huyễn'],
    'ongoing',
    true,
    6
  )
  on conflict (slug) do update set is_published = true
  returning id into v_book_id;

  delete from chapters where book_id = v_book_id;

  for i in 1..6 loop
    v_free := i <= 5;
    v_content :=
      'Đây là đoạn mở đầu của chương ' || i || '. ' ||
      repeat('Gió thổi qua rặng trúc, tiếng lá xào xạc như lời thì thầm của núi rừng. ', 8) ||
      chr(10) || chr(10) ||
      repeat('Nhân vật chính bước đi trên con đường mòn, lòng đầy trăn trở về con đường tu luyện phía trước. ', 8) ||
      chr(10) || chr(10) ||
      repeat('Ánh trăng bàng bạc phủ lên vạn vật một màu tĩnh lặng, và trong khoảnh khắc ấy, mọi âu lo dường như tan biến. ', 8);

    insert into chapters (book_id, index, title, is_free, word_count)
    values (v_book_id, i, 'Chương ' || i || ': Khởi đầu thứ ' || i, v_free, 400)
    returning id into v_ch_id;

    insert into chapter_contents (chapter_id, content)
    values (v_ch_id, v_content);
  end loop;
end $$;
