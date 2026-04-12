import MainChart from './MainChart'
import TradeBar from './TradeBar'
import PositionsTable from './PositionsTable'

export default function CenterPanel() {
  return (
    <section className="flex-1 bg-background overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0">
        <MainChart />
      </div>
      <TradeBar />
      <div className="h-48 min-h-[8rem] border-t border-border overflow-auto">
        <PositionsTable />
      </div>
    </section>
  )
}
