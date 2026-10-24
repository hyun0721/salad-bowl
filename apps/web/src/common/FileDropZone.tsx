import type { ReactNode } from 'react'
import { Button, DropZone, FileTrigger } from 'react-aria-components'

type Props = { label: string; className?: string; onFile: (file: File) => void; children: ReactNode }

export default function FileDropZone({ label, className, onFile, children }: Props) {
  return (
    <DropZone aria-label={label} className={className}
      onDrop={async (event) => {
        const item = event.items.find((item) => item.kind === 'file')
        if (item?.kind === 'file') onFile(await item.getFile())
      }}>
      {children}
    </DropZone>
  )
}

type PickerProps = { accept: string[]; onFile: (file: File) => void; className?: string; children: ReactNode }

export function FilePickerButton({ accept, onFile, className, children }: PickerProps) {
  return (
    <FileTrigger acceptedFileTypes={accept} onSelect={(files) => {
      const file = files?.[0]
      if (file) onFile(file)
    }}>
      <Button className={className}>{children}</Button>
    </FileTrigger>
  )
}
