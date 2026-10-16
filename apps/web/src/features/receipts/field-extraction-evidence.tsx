import {useEffect,useState} from "react";
import type {LabelField} from "./label-profiles";
import type {LabelDraft,ScanReview} from "./scan-review-data";
export function FieldExtractionEvidence({field,draft,review}:{field:LabelField;draft:LabelDraft;review:ScanReview}){
 const evidence=review.extraction?.fields[field];const [url,setUrl]=useState<string>();
 useEffect(()=>{let closed=false,objectUrl:string|undefined;setUrl(undefined);const box=evidence?.box,image=evidence?.image??review.image;
  if(box&&image)void createImageBitmap(image).then(async bitmap=>{try{const canvas=document.createElement("canvas");const x=Math.max(0,box.x0),y=Math.max(0,box.y0),width=Math.min(bitmap.width-x,box.x1-x),height=Math.min(bitmap.height-y,box.y1-y);if(width<=0||height<=0)return;canvas.width=Math.ceil(width);canvas.height=Math.ceil(height);const context=canvas.getContext("2d");if(!context)return;context.drawImage(bitmap,x,y,width,height,0,0,width,height);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));if(blob&&!closed){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}}finally{bitmap.close();}}).catch(()=>{});
  return()=>{closed=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[review.image,evidence?.image,evidence?.box?.x0,evidence?.box?.y0,evidence?.box?.x1,evidence?.box?.y1]);
 if(!evidence)return null;
 const edited=draft[field]!==review.draft[field];
 return <span className="field-extraction-evidence"><small>{edited?"Edited":evidence.state==="recognized"?"Recognized · Review required":evidence.state==="missing"?"Missing":"Needs review"}{evidence.confidence!==null?` · Engine score ${evidence.confidence}/100`:""}</small>{evidence.issue&&<small>{evidence.issue}</small>}{evidence.recognizedValue&&evidence.recognizedValue!==draft[field]&&<small>Read from label: {evidence.recognizedValue}</small>}{url&&<details><summary>Inspect field crop</summary><img src={url} alt={"Recognized region for "+field}/></details>}</span>;
}
