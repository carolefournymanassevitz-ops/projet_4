import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { UploadPage } from './pages/UploadPage';
import { MyFilesPage } from './pages/MyFilesPage';
import { DownloadPage } from './pages/DownloadPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/inscription" element={<RegisterPage />} />
        <Route
          path="/televersement"
          element={
            <ProtectedRoute>
              <UploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mes-fichiers"
          element={
            <ProtectedRoute>
              <MyFilesPage />
            </ProtectedRoute>
          }
        />
        {/* Route publique : accessible à quiconque possède le lien, sans compte */}
        <Route path="/d/:id" element={<DownloadPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
