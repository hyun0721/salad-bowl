import styles from './PagePlaceholder.module.css'

export default function PagePlaceholder({ title }: { title: string }) {
  return (
    <section className={styles.page}>
      <h1>{title}</h1>
      <p className={styles.lead}>이 화면은 다음 단계에서 만듭니다.</p>
    </section>
  )
}
