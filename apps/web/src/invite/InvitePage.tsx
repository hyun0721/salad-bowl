import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/errors'
import { errorMessage } from '../common/errorMessage'
import { formatInstant } from '../common/format'
import ui from '../common/ui.module.css'
import { usePageTitle } from '../common/usePageTitle'
import { rememberSelectedGroup } from '../groups/GroupProvider'
import { inviteApi, type InvitePreview } from './inviteApi'
import styles from './InvitePage.module.css'

export default function InvitePage() {
  usePageTitle('그룹 초대')
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const preview = useQuery({ queryKey: ['invite', token], queryFn: () => inviteApi.preview(token) })
  const accept = useMutation({
    mutationFn: () => inviteApi.accept(token),
    onSuccess: async ({ groupId }) => {
      rememberSelectedGroup(groupId)
      await queryClient.invalidateQueries({ queryKey: ['groups'], exact: true, refetchType: 'all' })
      navigate('/dashboard', { replace: true })
    },
  })

  return (
    <div className={styles.page}>
      <main className={`${ui.card} ${styles.card}`}>
        <span className={styles.brand}>Salad Bowl</span>
        <h1>그룹 초대</h1>
        {preview.isPending && <p className={ui.status}>초대 정보를 불러오는 중입니다.</p>}
        {preview.isError && <InviteError error={preview.error} onRetry={() => void preview.refetch()} />}
        {preview.data && (
          <InviteDetails preview={preview.data} joining={accept.isPending} onJoin={() => accept.mutate()} />
        )}
        {accept.isError && <p role="alert" className={ui.alert}>{errorMessage(accept.error)}</p>}
      </main>
    </div>
  )
}

function InviteError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  // 4xx(없음·만료·차단)는 다시 시도해도 같다. 서버·네트워크 오류만 다시 시도를 보여준다.
  const final = error instanceof ApiError && error.status >= 400 && error.status < 500
  return (
    <>
      <p role="alert" className={ui.alert}>{errorMessage(error)}</p>
      <div className={ui.row}>
        {!final && <button type="button" className={ui.button} onClick={onRetry}>다시 시도</button>}
        <Link to="/" className={`${ui.button} ${ui.linkButton}`}>홈으로</Link>
      </div>
    </>
  )
}

function InviteDetails({ preview, joining, onJoin }: { preview: InvitePreview; joining: boolean; onJoin: () => void }) {
  const full = preview.memberCount >= preview.maxMembers
  return (
    <>
      <p className={styles.groupName}>{preview.groupName}</p>
      <dl className={styles.facts}>
        <div><dt>인원</dt><dd>{preview.memberCount}/{preview.maxMembers}명</dd></div>
        <div><dt>링크 만료</dt><dd>{formatInstant(preview.expiresAt)}</dd></div>
      </dl>
      {preview.alreadyMember ? (
        <>
          <p className={ui.status}>이미 이 그룹의 멤버입니다.</p>
          <Link to="/dashboard" className={`${ui.button} ${ui.primary} ${ui.linkButton}`}>대시보드로 가기</Link>
        </>
      ) : full ? (
        <p className={ui.status}>그룹 정원이 찼습니다. 관리자에게 문의해 주세요.</p>
      ) : (
        <button type="button" className={`${ui.button} ${ui.primary}`} disabled={joining} onClick={onJoin}>
          그룹에 합류하기
        </button>
      )}
      <p className={ui.muted}>합류하면 내 거래가 이 그룹 멤버에게 공개됩니다. 그룹 관리에서 언제든 끌 수 있습니다.</p>
    </>
  )
}
