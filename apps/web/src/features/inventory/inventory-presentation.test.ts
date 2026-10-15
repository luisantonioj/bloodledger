import {describe,expect,it} from "vitest";
import {inventoryExpiryDate,inventoryTimeRemaining} from "./inventory-presentation";
const now=Date.parse("2026-10-15T00:00:00Z"),day=86400000;
describe("mockup inventory presentation",()=>{
 it("formats the actual expiry date in Manila as YYYY-MM-DD",()=>{expect(inventoryExpiryDate("2026-10-15T17:00:00Z")).toBe("2026-10-16");expect(inventoryExpiryDate("invalid")).toBe("Unavailable");});
 it("uses mockup display colors at 3 and 7 days without changing dates",()=>{for(const [days,tone] of [[1,"critical"],[3,"critical"],[4,"warning"],[7,"warning"],[8,"success"]] as const)expect(inventoryTimeRemaining(new Date(now+days*day).toISOString(),now)).toEqual({tone,label:`${days} day${days===1?"":"s"}`});});
 it("shows elapsed expiry days with a neutral expired tone",()=>{expect(inventoryTimeRemaining(new Date(now-2*day).toISOString(),now)).toEqual({tone:"expired",label:"Expired 2 days ago"});expect(inventoryTimeRemaining(new Date(now-day).toISOString(),now).label).toBe("Expired 1 day ago");expect(inventoryTimeRemaining(new Date(now).toISOString(),now).label).toBe("Expired less than a day ago");expect(inventoryTimeRemaining("invalid",now)).toEqual({tone:"neutral",label:"Unavailable"});});
});
