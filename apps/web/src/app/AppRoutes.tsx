import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { GroupProvider } from '../groups/GroupProvider'
import HomePage from '../home/HomePage'
import PagePlaceholder from '../pages/PagePlaceholder'
import AppLayout from './AppLayout'
import ClearCacheOnSignOut from './ClearCacheOnSignOut'
import PageLoading from './PageLoading'
import PublicOnly from './PublicOnly'
import RequireAuth from './RequireAuth'

const LoginPage = lazy(() => import('../auth/LoginPage'))
const InvitePage = lazy(() => import('../invite/InvitePage'))
const DashboardPage = lazy(() => import('../dashboard/DashboardPage'))
const TransactionsPage = lazy(() => import('../transactions/TransactionsPage'))
const UploadPage = lazy(() => import('../imports/UploadPage'))
const GroupsPage = lazy(() => import('../groups/GroupsPage'))

export default function AppRoutes() {
  return (
    <>
      <ClearCacheOnSignOut />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/invite/:token" element={<RequireAuth><InvitePage /></RequireAuth>} />
          <Route element={<RequireAuth><GroupProvider><AppLayout /></GroupProvider></RequireAuth>}>
            <Route index element={<HomePage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="groups" element={<GroupsPage />} />
          </Route>
          <Route path="*" element={<PagePlaceholder title="페이지를 찾을 수 없습니다" />} />
        </Routes>
      </Suspense>
    </>
  )
}
