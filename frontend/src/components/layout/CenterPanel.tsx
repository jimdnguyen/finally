import MainChart from './MainChart'
import TradeBar from './TradeBar'
import PositionsTable from './PositionsTable'
import PortfolioHeatmap from './PortfolioHeatmap'

export default function CenterPanel() {
  return (
    <section className="flex-1 bg-background overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0">
        <MainChart />
      </div>
      <TradeBar />
      <div className="h-64 min-h-[10rem] border-t border-border flex flex-col">
        <div className="h-[40%] min-h-[4rem] border-b border-border">
          <PortfolioHeatmap />
        </div>
        <div className="flex-1 overflow-auto">
          <PositionsTable />
        </div>
      </div>
    </section>
  )
}
