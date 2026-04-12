import Header from "@/components/layout/Header";
import WatchlistPanel from "@/components/layout/WatchlistPanel";
import CenterPanel from "@/components/layout/CenterPanel";
import ChatPanel from "@/components/layout/ChatPanel";

export default function Home() {
  return (
    <div className="flex flex-col h-full">
      <Header />
      <main className="grid grid-cols-[180px_1fr_300px] flex-1 overflow-hidden">
        <WatchlistPanel />
        <CenterPanel />
        <ChatPanel />
      </main>
    </div>
  );
}
