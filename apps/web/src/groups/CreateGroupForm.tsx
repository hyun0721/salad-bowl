import { useState, type FormEvent } from 'react'
import { errorMessage } from '../common/errorMessage'
import TextField from '../common/TextField'
import ui from '../common/ui.module.css'
import { useGroupMutations } from './useGroupMutations'

type Props = { onCreated: () => void }

/** 그룹 관리의 "그룹 만들기" 대화상자 안에 들어간다. 만들면 새 그룹이 선택되고 대화상자를 닫는다. */
export default function CreateGroupForm({ onCreated }: Props) {
  const { create } = useGroupMutations()
  const [name, setName] = useState('')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    create.mutate(name.trim(), { onSuccess: onCreated })
  }

  return (
    <form className={ui.stack} onSubmit={onSubmit}>
      <TextField label="그룹 이름" value={name} onChange={setName} isRequired maxLength={50} />
      <button type="submit" className={`${ui.button} ${ui.primary}`}
        disabled={create.isPending || name.trim() === ''}>만들기</button>
      {create.isError && <p role="alert" className={ui.alert}>{errorMessage(create.error)}</p>}
    </form>
  )
}
