import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({recognize:vi.fn(),terminate:vi.fn(),createWorker:vi.fn()}));
vi.mock("tesseract.js",()=>({OEM:{LSTM_ONLY:1},createWorker:mocks.createWorker}));
import {recognizeReceiptLabel} from "./receipt-ocr";
const lines=["DONATION NO: MM26-10-0001","BLOOD TYPE: A_POSITIVE","COMPONENT: CRYOPRECIPITATE","COLLECTED AT: 2026-10-14T00:00:00.000Z","EXPIRES AT: 2026-12-14T00:00:00.000Z"].map(text=>({text,confidence:99}));
const result=(rows=lines)=>({data:{blocks:[{paragraphs:[{lines:rows}]}]}});
beforeEach(()=>{vi.resetAllMocks();mocks.createWorker.mockResolvedValue({recognize:mocks.recognize,terminate:mocks.terminate});mocks.recognize.mockResolvedValue(result());});
describe("requester local receipt OCR",()=>{
 it("reuses strict five-field policy and local assets, then terminates the worker",async()=>{const row=await recognizeReceiptLabel({} as File,new AbortController().signal,()=>{});expect(row.label.donationNumber).toBe("MM26-10-0001");expect(row.label.componentType).toBe("CRYOPRECIPITATE");expect(mocks.createWorker).toHaveBeenCalledWith("eng",1,expect.objectContaining({workerPath:"/capture/ocr-assets/worker.min.js",cacheMethod:"none"}));expect(mocks.terminate).toHaveBeenCalledTimes(1);});
 it("rejects low confidence and does not keep untrusted extracted text",async()=>{mocks.recognize.mockResolvedValue(result(lines.map(row=>({...row,confidence:80}))));await expect(recognizeReceiptLabel({} as File,new AbortController().signal,()=>{})).rejects.toThrow("INBOUND_OCR_CONFIDENCE_LOW");expect(mocks.terminate).toHaveBeenCalledTimes(1);});
 it("rejects unexpected or sensitive fields",async()=>{mocks.recognize.mockResolvedValue(result([...lines,{text:"PATIENT: SYNTHETIC",confidence:99}]));await expect(recognizeReceiptLabel({} as File,new AbortController().signal,()=>{})).rejects.toThrow("CAPTURE_PROHIBITED_TEXT");expect(mocks.terminate).toHaveBeenCalledTimes(1);});
 it("cancels recognition and terminates exactly once",async()=>{const controller=new AbortController();mocks.recognize.mockImplementation(async()=>{controller.abort();return result();});await expect(recognizeReceiptLabel({} as File,controller.signal,()=>{})).rejects.toThrow();expect(mocks.terminate).toHaveBeenCalledTimes(1);});
 it("does not start an already-cancelled read",async()=>{const controller=new AbortController();controller.abort();await expect(recognizeReceiptLabel({} as File,controller.signal,()=>{})).rejects.toThrow();expect(mocks.createWorker).not.toHaveBeenCalled();});
});
