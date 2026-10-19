import { Route, Routes } from 'react-router'
import LoginPage from '../auth/LoginPage'
import { GroupProvider } from '../groups/GroupProvider'
import HomePage from '../home/HomePage'
import UploadPage from '../imports/UploadPage'
import PagePlaceholder from '../pages/PagePlaceholder'
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
        <Route path="/invite/:token" element={<RequireAuth><PagePlaceholder title="그룹 초대" /></RequireAuth>} />
        <Route element={<RequireAuth><GroupProvider><AppLayout /></GroupProvider></RequireAuth>}>
          <Route index element={<HomePage />} />
          <Route path="dashboard" element={<PagePlaceholder title="그룹 대시보드" />} />
          <Route path="transactions" element={<PagePlaceholder title="거래 목록" />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="groups" element={<PagePlaceholder title="그룹 관리" />} />
        </Route>
        <Route path="*" element={<PagePlaceholder title="페이지를 찾을 수 없습니다" />} />
      </Routes>
    </>
  )
}
