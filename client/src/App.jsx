import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import { useAuth } from './lib/auth.jsx';
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx';
import ProjectPage from './pages/ProjectPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';

function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
