export default function PagePlaceholder({ title }: { title: string }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <h1>{title}</h1>
      <p style={{ margin: 0, color: 'var(--ink-muted)' }}>이 화면은 다음 단계에서 만듭니다.</p>
    </section>
  )
}
