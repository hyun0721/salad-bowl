import { useState, type FormEvent } from 'react'
import { errorMessage } from '../common/errorMessage'
import ui from '../common/ui.module.css'
import styles from './GroupsPage.module.css'
import { useGroupMutations } from './useGroupMutations'

export default function CreateGroupForm() {
  const { create } = useGroupMutations()
  const [name, setName] = useState('')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    create.mutate(name.trim(), { onSuccess: () => setName('') })
  }

  return (
    <form className={ui.stack} aria-labelledby="create-group-title" onSubmit={onSubmit}>
      <h3 id="create-group-title" className={styles.subTitle}>새 그룹 만들기</h3>
      <label className={ui.field}>
        <span>그룹 이름</span>
        <input className={ui.input} required maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="submit" className={`${ui.button} ${ui.primary}`}
        disabled={create.isPending || name.trim() === ''}>만들기</button>
      {create.isError && <p role="alert" className={ui.alert}>{errorMessage(create.error)}</p>}
    </form>
  )
}
