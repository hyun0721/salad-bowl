import ui from '../../common/ui.module.css'
import { usePageTitle } from '../../common/usePageTitle'
import TaxHeader from '../TaxHeader'

/** 소득공제 › 입력자료. 내용은 Task 5.3~5.5에서 채운다. */
export default function TaxInputsPage() {
  usePageTitle('입력자료 · 소득공제')
  return <div className={ui.stack}><TaxHeader /></div>
}
