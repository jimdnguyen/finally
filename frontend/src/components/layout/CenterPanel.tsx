'use client'

import { useState } from 'react'
import MainChart from './MainChart'
import TradeBar from './TradeBar'
import TabStrip from './TabStrip'
import PositionsTable from './PositionsTable'
import PortfolioHeatmap from './PortfolioHeatmap'
import PnLHistoryChart from './PnLHistoryChart'

const TABS = ['Heatmap', 'Positions', 'P&L History']

export default function CenterPanel() {
  const [activeTab, setActiveTab] = useState('Positions')

  return (
    <section className="flex-1 bg-background overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0">
        <MainChart />
      </div>
      <TradeBar />
      <div className="border-t border-border">
        <TabStrip tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      <div className="h-64 min-h-[10rem] overflow-auto">
        {activeTab === 'Heatmap' && <PortfolioHeatmap />}
        {activeTab === 'Positions' && <PositionsTable />}
        {activeTab === 'P&L History' && <PnLHistoryChart />}
      </div>
    </section>
  )
}
