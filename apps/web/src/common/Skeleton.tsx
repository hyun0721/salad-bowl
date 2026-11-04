import type { ReactNode } from 'react'
import styles from './Skeleton.module.css'

type Length = number | string

type Props = { width?: Length; height: Length; radius?: Length; className?: string }

export default function Skeleton({ width = '100%', height, radius, className }: Props) {
  return <span aria-hidden="true" className={className ? `${styles.block} ${className}` : styles.block}
    style={{ width, height, borderRadius: radius }} />
}

type RegionProps = { label?: string; className?: string; children: ReactNode }

/** 스켈레톤 묶음을 화면 낭독기에는 로딩 문구 하나로 알린다. */
export function SkeletonRegion({ label = '불러오는 중입니다.', className, children }: RegionProps) {
  return (
    <div role="status" aria-busy="true" className={className ? `${styles.region} ${className}` : styles.region}>
      <span className={styles.srOnly}>{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}
