import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
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
const GroupsPage = lazy(() => import('../groups/GroupsPage'))

/** 옛 업로드 주소. 홈의 월별 등록 현황이 ?month=를 받아 그 달 창을 연다. */
function UploadRedirect() {
  return <Navigate to={{ pathname: '/', search: useLocation().search }} replace />
}

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
            <Route path="dashboard/:level?/:view?" element={<DashboardPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="upload" element={<UploadRedirect />} />
            <Route path="groups" element={<GroupsPage />} />
          </Route>
          <Route path="*" element={<PagePlaceholder title="페이지를 찾을 수 없습니다" />} />
        </Routes>
      </Suspense>
    </>
  )
}
