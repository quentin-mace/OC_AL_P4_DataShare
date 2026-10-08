import type { RouteObject } from 'react-router'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { PublicLayout } from '../components/layout/PublicLayout'
import { DownloadPage } from '../pages/DownloadPage'
import { FilesPage } from '../pages/FilesPage'
import { HomePage } from '../pages/HomePage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { RegisterPage } from '../pages/RegisterPage'
import { paths } from './paths'
import { RequireAuth } from './RequireAuth'

// Exportées à part du routeur pour que les tests les montent dans un
// routeur mémoire, sans dépendre de l'URL du navigateur.
export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: paths.home, element: <HomePage /> },
      { path: paths.login, element: <LoginPage /> },
      { path: paths.register, element: <RegisterPage /> },
      { path: paths.download(':downloadToken'), element: <DownloadPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <DashboardLayout />,
        children: [{ path: paths.files, element: <FilesPage /> }],
      },
    ],
  },
]
