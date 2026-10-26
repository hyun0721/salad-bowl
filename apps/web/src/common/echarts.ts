import * as echarts from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, GraphicComponent } from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import { SVGRenderer } from 'echarts/renderers'

echarts.use([PieChart, TooltipComponent, GraphicComponent, LabelLayout, SVGRenderer])

export { echarts }
export type { EChartsCoreOption as ChartOption, ECharts as ChartInstance } from 'echarts/core'
