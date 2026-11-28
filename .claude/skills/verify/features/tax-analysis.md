# Tax deduction analysis

소득공제 › 분석·지출계획 (`/tax/analysis`, `h1` `소득공제` on wide screens) shows one member's analysis for the selected tax year in three steps, one at a time at every width: `① 현황` (deduction, threshold and limits, usage shares, the folded calculation), `② 지출계획` (the rest-of-year plan, saved only by `[계산하기]`), and `③ 추천` (current plan against the recommended allocation). The server calculates every number; the page draws them and saves the plan. Wide screens keep one centered column of at most 720px. The data is personal and does not change with the header group. This verification map is `tax-analysis.md`.

## Sub-features

- `analysis-entry`: `소득공제` in `navigation "주 메뉴"` opens `/tax`. It goes to `/tax/analysis` at `① 현황` when the selected year's record has at least one statement (incomplete counts), and to `/tax/inputs` when there is no record or no statement. The selected year is the one the tax pages keep in memory (this Korean year after a reload). The sidebar lists `입력자료`, `분석·지출계획` (and `연도별 세법 관리` for service admins) under `소득공제`; narrow screens show the in-page `소득공제 메뉴` with `입력자료 | 분석·지출계획` (plus `세법 관리` for admins).
- `analysis-steps`: `tablist "분석 단계"` with `① 현황`, `② 지출계획`, `③ 추천`, and `[이전]` / `[다음]` under the step. Step tabs are 44px tall at narrow widths and 40px at wide widths; `[이전]` / `[다음]` stay at least 44px tall at narrow widths and 40px at wide widths. Changing the step moves focus to the selected tab.
- `analysis-facts`: one line `적용 세법 YYYY년 귀속 vN · 적용일 YYYY-MM-DD · 자료 기준일 … · 예상 총급여 ₩ …` (`세법 준비 중` when the record has no law). Notices: `추정` with the date range when statement dates differ, `근로기간 확인 필요` when the months are not 1–12, and `새 세법 버전이 적용됐어요` with `[새 버전으로 다시 계산]` (the old result stays until it is pressed).
- `analysis-status`: `region "현재 요약"` with 소득공제액 (`과세표준에서 빼는 금액 · 환급액 아님`), 최저사용금액 `달성`/`미달` and the share of the threshold, 기본한도 사용, 추가한도 사용. `사용 비율` has the tables `소비구분별` and `결제수단별` over the 12-cell year total and says so in the `분모:` line; a 0원 total shows `입력 합계가 0원이라 비율을 계산하지 않아요.`. `[계산 과정 보기]` starts collapsed and expands to `1. 최저사용금액 차감` → `2. 공제율 적용` → `3. 한도`, ending at the deduction. `참고: 기본한도까지 남은 공제 여유` closes the step. Below the threshold the summary states 0원 and the remaining amount, with no advice to spend more.
- `analysis-plan`: `남은 기간 지출계획` has four fieldsets (일반, 전통시장, 대중교통, 문화체육), each with `신용카드 고정`, `체크카드·현금영수증 고정`, `바꿀 수 있음` and its `합계`, then `총액`. Editing alone sends nothing and keeps ③ as it was. `[계산하기]` saves, recalculates and moves to ③. A blank cell disables `[계산하기]` with the reason.
- `analysis-recommend`: `추천 결과` shows `현재 계획: 지금까지의 결제수단 비율(…)`, the allocation table (current plan against the recommendation, equal totals, year-end deductions, `현재 계획 대비 차이`), `이유` and `가정`, or `차이 없음` with the reason. `추천 결과 도움말` explains why 체크카드 and 현금영수증 are one group. A year without a saved plan shows `[② 지출계획으로 가기]`.
- `analysis-pending`: with no statement or blank cells, ① and ③ show `자료를 완료하면 계산해요`, `빈 칸 n개` and `[입력자료로 가기]`. With complete data but no law, they show only `세법 준비 중`. ② stays open in both cases and `[계산하기]` only saves.
- `analysis-mask`: the `지출` mask hides every deduction and spending amount (`₩ •••••`, `+₩ •••••`) but not the percentages; the `수입` mask hides the salary only.

## How to get to it (user POV)

- Click `소득공제` in `navigation "주 메뉴"` while the selected year has statements.
- Or click `분석·지출계획` under `소득공제` (wide) or in `소득공제 메뉴` (narrow).

## Driving it with the built-in browser

Preconditions:

- Baseline seed (see tax-inputs.md) and `bin/doctor.sh` passing, including `seed tax analysis YYYY`. The owner's `YYYY` record holds the wireframe sample: salary ₩ 50,000,000, year total ₩ 17,800,000, all statements dated `YYYY-06-30`, and the saved plan 일반 500,000 / 300,000 / 1,200,000, 전통시장 0 / 100,000 / 100,000, 대중교통 100,000 / 0 / 0, 문화체육 0 / 0 / 100,000.

- **Entry.** As `verify@example.test` at `desktop`, click `소득공제`: `/tax/analysis` opens at `① 현황` and `분석·지출계획` has `aria-current="page"`. As `verify5@example.test` (no record) the same click opens `/tax/inputs`.
- **Sample numbers.** At `mobile`, 320×700 and `desktop`, ① reads 소득공제액 ₩ 1,475,000, 최저사용금액 `달성 · 142.4%`, 기본한도 사용 49.2%, 추가한도 사용 0.0%, 소비구분별 92.7 / 3.4 / 2.8 / 1.1%, 결제수단별 82.0 / 14.6 / 3.4%, and `참고: 기본한도까지 남은 공제 여유 ₩ 1,525,000`. ③ reads `신용 82.0% · 체크 14.6% · 현금 3.4%`, 연말 예상 소득공제액 ₩ 1,997,272 and ₩ 2,150,000, `현재 계획 대비 차이` +₩ 152,728, and the 일반 reason with ₩ 1,018,183.
- **Calculation.** `[계산 과정 보기]` has `aria-expanded="false"` on load. Expanded, the headings run 1 → 2 → 3, 차감액 reads − ₩ 1,875,000, 공제 가능 금액 ₩ 1,475,000, and the last line ₩ 1,475,000 equals the summary.
- **One step at a time.** At each width the page has exactly one `tabpanel`. `[다음]` and `[이전]` move the step and focus the selected tab. At `desktop` the page column is centered and at most 720px wide (`getBoundingClientRect().width` of the element holding the header).
- **Plan saves only on 계산하기.** In ②, change 일반 `바꿀 수 있음` to 900,000 and leave the field: the line `저장하지 않은 변경이 있어요. …` shows, ③ still reads +₩ 152,728, and the network panel has no `PUT …/plan`. Back in ②, press `[계산하기]`: one `PUT …/plan`, the page moves to ③ with new numbers, and a reload shows 900,000 in ②. Restore 1,200,000 and press `[계산하기]` again; ③ returns to +₩ 152,728.
- **Conflict.** Open the analysis in two tabs. Save the plan in the first, then change and save it in the second: `다른 곳에서 수정되거나 삭제됐어요. 저장하지 않았어요.` with `[다시 불러오기]`, which shows the first tab's values and keeps the step at ②.
- **Incomplete.** As `verify5@example.test`, enter basic info for `YYYY` and add one card with only 일반 신용카드 filled. `소득공제` now opens ①, which shows `자료를 완료하면 계산해요`, `빈 칸 11개` and `[입력자료로 가기]`. ② shows `… [계산하기]는 지출계획을 저장만 해요.`, saves, and moves to ③, which shows the same notice. Fill the card's blanks and the cash receipt on the inputs page: ③ then shows a recommendation from the saved plan.
- **Law pending.** As `verify5@example.test`, pick next year in `귀속연도`, enter basic info, add one card with all 8 cells, and fill the cash receipt with 0원 (`[4칸 0원으로 채우기]`, then a date). ① and ③ show only `세법 준비 중` with no blank count and no button; ② still saves.
- **Mask.** Turn on `지출`: ① and ③ amounts read `₩ •••••`, the difference `+₩ •••••`, percentages stay, the salary in the facts line stays. Turn on only `수입`: only the salary hides. Turn masks off afterwards.
- **Sizes.** At `mobile`, read computed sizes: card titles 16px, summary values 16px, body text 13px (`--text-body`), the facts line, notices and summary sublines 12px (`--text-sub`), buttons 13px (`--text-button`), plan inputs 16px. Step tabs and `[이전]` / `[다음]` are 44px tall at `mobile` and 40px at `desktop`. No page-level horizontal scroll at 320px; only the ③ table may scroll inside itself.
- **Newer law (run last).** As `verify@example.test`, create a draft for `YYYY` on `연도별 세법 관리`, save it unchanged and apply it. Open the analysis: `새 세법 버전이 적용됐어요. 지금 결과는 v1 기준이며, 누르기 전에는 그대로예요.` shows and the numbers stay. `[새 버전으로 다시 계산]` changes the facts line to the new version and removes the notice. Applied versions cannot be deleted; relaunch the stack for a clean DB.

## Gotchas

- The analysis is not kept in the cache after leaving the page (`gcTime 0`), so opening it always shows `분석 불러오는 중` first and never an earlier result.
- The plan form keeps the `rowVersion` from when editing began, so a save from another tab turns this save into a 409. `rowVersion` values are opaque sequence numbers.
- The step resets to ① only when the page opens. Changing `귀속연도` keeps the step. Unsaved plan edits are kept for one year only: starting to edit another year drops them.
- `remainingToThreshold` is the smallest whole won that passes the threshold, so a total ₩ 3,200,000 short of it reads ₩ 3,200,001.
- The page computes only display shares (one decimal, half up, so the sum may differ from 100.0%) and the limit headroom. `현재 계획:` uses the server's `methodShare`.
