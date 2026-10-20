import { Route, Routes } from 'react-router'
import LoginPage from '../auth/LoginPage'
import DashboardPage from '../dashboard/DashboardPage'
import { GroupProvider } from '../groups/GroupProvider'
import GroupsPage from '../groups/GroupsPage'
import HomePage from '../home/HomePage'
import UploadPage from '../imports/UploadPage'
import InvitePage from '../invite/InvitePage'
import PagePlaceholder from '../pages/PagePlaceholder'
import TransactionsPage from '../transactions/TransactionsPage'
import AppLayout from './AppLayout'
import ClearCacheOnSignOut from './ClearCacheOnSignOut'
import PublicOnly from './PublicOnly'
import RequireAuth from './RequireAuth'

export default function AppRoutes() {
  return (
    <>
      <ClearCacheOnSignOut />
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
    </>
  )
}
