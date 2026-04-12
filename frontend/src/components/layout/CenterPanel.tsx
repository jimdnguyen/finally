import MainChart from './MainChart'

export default function CenterPanel() {
  return (
    <section className="flex-1 bg-background overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0">
        <MainChart />
      </div>
      {/* TODO: TabStrip + TradeBar (Story 2.x) */}
    </section>
  )
}
