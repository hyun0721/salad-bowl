import { Link } from 'react-router'
import ui from '../common/ui.module.css'

/** 속한 그룹이 없을 때. 그룹이 없어도 내 가계부·업로드·내 거래는 쓸 수 있다. */
export default function NoGroupNotice() {
  return (
    <section aria-labelledby="no-group-title" className={ui.card}>
      <h2 id="no-group-title">아직 속한 그룹이 없습니다</h2>
      <p className={ui.status}>
        그룹을 만들어 초대 링크로 가족·친구를 부르거나, 받은 초대 링크를 열어 합류합니다.
        그룹이 없어도 내 가계부·업로드·내 거래는 그대로 쓸 수 있습니다.
      </p>
      <div className={ui.row}>
        <Link to="/groups" className={`${ui.button} ${ui.primary} ${ui.linkButton}`}>그룹 만들기</Link>
        <Link to="/" className={`${ui.button} ${ui.linkButton}`}>내 가계부로</Link>
      </div>
    </section>
  )
}
