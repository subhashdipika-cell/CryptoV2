"use client";

import { useState } from "react";
import type { Market } from "@/lib/types";
import { Sidebar, Header, tabs, type TabId } from "./navigation";
import { Overview } from "./overview";
import { Markets } from "./markets";
import { Intelligence } from "./intelligence";
import { PatternScanner } from "./patterns";
import { OptionsSuite } from "./options-suite";
import { StrategyCockpit } from "./cockpit";
import { OrderTicket } from "./order-ticket";
import { Feedback } from "./feedback";

export function TradingTerminal(){
 const [active,setActive]=useState<TabId>("overview"); const [menu,setMenu]=useState(false); const [order,setOrder]=useState<Market|null>(null);
 const content={overview:<Overview onOpenOrder={setOrder}/>,markets:<Markets/>,insights:<Intelligence/>,patterns:<PatternScanner/>,options:<OptionsSuite/>,cockpit:<StrategyCockpit/>}[active];
 return <div className="min-h-screen"><Sidebar active={active} onChange={setActive} open={menu} onClose={()=>setMenu(false)}/><div className="lg:pl-[224px]"><Header onMenu={()=>setMenu(true)} title={tabs.find(t=>t.id===active)?.label??"Overview"}/><main className="mx-auto max-w-[1680px] p-4 sm:p-6">{content}</main></div>{order&&<OrderTicket market={order} onClose={()=>setOrder(null)}/>}<Feedback/></div>
}
