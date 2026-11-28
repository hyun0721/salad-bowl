import { useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../../common/errorMessage'
import ui from '../../common/ui.module.css'
import { isStale, taxKeys } from '../taxApi'
import styles from './inputs.module.css'

type Props = { error: unknown; year: number; onReload: () => void }

/**
 * 입력 창의 저장 실패. 다른 곳에서 먼저 고쳤으면(409·404) 입력을 남긴 채 알리고, [다시 불러오기]를 누르면 새 값을 받고 창을 닫는다.
 * 그 밖의 실패는 입력을 그대로 두고 다시 저장하게 한다.
 */
export default function SaveError({ error, year, onReload }: Props) {
  const client = useQueryClient()
  if (!error) return null
  if (!isStale(error)) return <p role="alert" className={ui.alert}>{errorMessage(error)} 입력한 값은 그대로 있어요.</p>
  return (
    <div className={styles.split}>
      <p role="alert" className={ui.alert}>다른 곳에서 수정되거나 삭제됐어요. 저장하지 않았어요.</p>
      <button type="button" className={ui.button}
        onClick={() => { void client.invalidateQueries({ queryKey: taxKeys.year(year) }); onReload() }}>다시 불러오기</button>
    </div>
  )
}
