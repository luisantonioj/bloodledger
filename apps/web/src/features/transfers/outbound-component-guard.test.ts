import {describe,it,expect} from "vitest";
import {outboundComponentMatches} from "./outbound-verification";
import {reviewOcrLines} from "../receipts/scan-review-data";
const recognition=reviewOcrLines(["DONATION NO: MM26-01-0001","BLOOD TYPE: A_POSITIVE","COMPONENT: WHOLE_BLOOD","COLLECTED AT: 2026-09-17T00:00:00.000Z","EXPIRES AT: 2026-10-17T00:00:00.000Z"].map(text=>({text,confidence:99}))).verified!;
const component=(componentType:string)=>({componentId:"COMP_TEST",componentType,inventoryStatus:"RESERVED",inventoryVersion:1});
describe("F1 outbound component usability guard",()=>{
 it("allows a strict OCR-read component matching every reserved member",()=>expect(outboundComponentMatches(recognition,{components:[component("WHOLE_BLOOD"),{...component("WHOLE_BLOOD"),componentId:"COMP_OTHER"}]})).toBe(true));
 it("rejects a sibling component even when its Donation No. is identical",()=>expect(outboundComponentMatches({...recognition,label:{...recognition.label,componentType:"FRESH_FROZEN_PLASMA"}},{components:[component("WHOLE_BLOOD")]})).toBe(false));
 it("rejects absent OCR, empty membership, unknown or conflicting reservation products",()=>{expect(outboundComponentMatches(undefined,{components:[component("WHOLE_BLOOD")]})).toBe(false);expect(outboundComponentMatches(recognition,{components:[]})).toBe(false);expect(outboundComponentMatches(recognition,{components:[component("UNKNOWN")]})).toBe(false);expect(outboundComponentMatches(recognition,{components:[component("WHOLE_BLOOD"),component("PLATELETS")]})).toBe(false);});
});
