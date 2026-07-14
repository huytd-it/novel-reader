import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useReaderSettings, applySettingsToDOM } from './stores/readerSettings';
import Library from './routes/Library';
import BookDetail from './routes/BookDetail';
import Reader from './routes/Reader';
import Auth from './routes/Auth';
import Account from './routes/Account';
import Terms from './routes/Terms';
import NotFound from './routes/NotFound';

// Route admin kéo theo parser EPUB (jszip + fast-xml-parser) → lazy-load để
// không phình bundle chính của người đọc.
const AdminImport = lazy(() => import('./routes/AdminImport'));
const AdminBooks = lazy(() => import('./routes/AdminBooks'));
const AdminBookEdit = lazy(() => import('./routes/AdminBookEdit'));
const AdminAnalytics = lazy(() => import('./routes/AdminAnalytics'));
const AdminAnnouncements = lazy(() => import('./routes/AdminAnnouncements'));

/** Đồng bộ reader settings → DOM (data-theme, CSS vars) ở cấp app. */
function SettingsApplier() {
  const theme = useReaderSettings((s) => s.theme);
  const sizeLevel = useReaderSettings((s) => s.sizeLevel);
  const font = useReaderSettings((s) => s.font);

  useEffect(() => {
    applySettingsToDOM({ theme, sizeLevel, font });
  }, [theme, sizeLevel, font]);

  return null;
}

export default function App() {
  return (
    <>
      <SettingsApplier />
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/truyen/:slug" element={<BookDetail />} />
        <Route path="/doc/:bookSlug/:chapterIndex" element={<Reader />} />
        <Route path="/dang-nhap" element={<Auth />} />
        <Route path="/tai-khoan" element={<Account />} />
        <Route path="/dieu-khoan" element={<Terms />} />
        <Route
          path="/admin/import"
          element={
            <Suspense fallback={null}>
              <AdminImport />
            </Suspense>
          }
        />
        <Route
          path="/admin/books"
          element={
            <Suspense fallback={null}>
              <AdminBooks />
            </Suspense>
          }
        />
        <Route
          path="/admin/books/:id"
          element={
            <Suspense fallback={null}>
              <AdminBookEdit />
            </Suspense>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <Suspense fallback={null}>
              <AdminAnalytics />
            </Suspense>
          }
        />
        <Route
          path="/admin/announcements"
          element={
            <Suspense fallback={null}>
              <AdminAnnouncements />
            </Suspense>
          }
        />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </>
  );
}
