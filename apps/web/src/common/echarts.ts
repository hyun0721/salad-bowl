import * as echarts from 'echarts/core'
import { PieChart, LineChart } from 'echarts/charts'
import { TooltipComponent, GraphicComponent, GridComponent } from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import { SVGRenderer } from 'echarts/renderers'

echarts.use([PieChart, LineChart, TooltipComponent, GraphicComponent, GridComponent, LabelLayout, SVGRenderer])

export { echarts }
export type { EChartsCoreOption as ChartOption, ECharts as ChartInstance } from 'echarts/core'
