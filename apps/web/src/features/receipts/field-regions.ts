import {LABEL_PROFILES,type LabelField} from "./label-profiles";
import type {OcrBox,OcrLine} from "./label-extraction";
// Draft layout windows, bounded by the next printed heading. No barcode search.
export function locateFieldRegions(lines:OcrLine[],profileId:string,width:number,height:number):{field:LabelField;box:OcrBox}[]{
 const profile=LABEL_PROFILES.find(row=>row.id===profileId);if(profile?.status!=="DRAFT_REFERENCE")return [];
 const headings=lines.flatMap(line=>{
  if(!line.bbox)return [];
  const text=line.text.toUpperCase().replace(/\./g,"").replace(/\s+/g," ").trim();
  const field=(Object.keys(profile.anchors) as LabelField[]).find(key=>profile.anchors[key]?.some(anchor=>text===anchor||text.startsWith(anchor+":")||text.startsWith(anchor+" ")||text.startsWith(anchor+"/")));
  return field?[{field,box:line.bbox}]:[];
 });
 return headings.slice(0,5).flatMap(({field,box})=>{
  const rowHeight=box.y1-box.y0;if(rowHeight<=0)return [];
  const right=headings.filter(item=>item.box.x0>box.x1&&Math.abs(item.box.y0-box.y0)<rowHeight).map(item=>item.box.x0-2);
  const x0=Math.max(0,Math.floor(box.x0-4)),x1=Math.min(width,...right,Math.ceil(Math.max(box.x1+4,box.x0+width*.45)));
  const below=headings.filter(item=>item.box.y0>box.y1&&item.box.x0<x1&&item.box.x1>x0).map(item=>item.box.y0-2);
  const y0=Math.max(0,Math.floor(box.y0-4)),y1=Math.min(height,...below,Math.ceil(box.y1+rowHeight*4));
  return x1>x0&&y1>y0?[{field,box:{x0,y0,x1,y1}}]:[];
 });
}
