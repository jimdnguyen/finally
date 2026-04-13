'use client'

interface TabStripProps {
  tabs: string[]
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function TabStrip({ tabs, activeTab, onTabChange }: TabStripProps) {
  return (
    <div className="h-[30px] flex items-center border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={
            tab === activeTab
              ? 'px-4 text-xs font-semibold cursor-pointer text-text-primary border-b-2 border-blue-primary h-full'
              : 'px-4 text-xs font-semibold cursor-pointer text-text-muted h-full'
          }
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
