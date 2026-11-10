// Exported PDFs compress their page content. Tests read the text by inflating each
// FlateDecode stream and appending it to the raw file text, so plain substring checks work.
import {readFile} from "node:fs/promises";
import {inflateSync} from "node:zlib";

export async function readPdfText(path:string):Promise<string>{
  const bytes=await readFile(path),raw=bytes.toString("latin1"),parts=[raw];
  const pattern=/stream\r?\n/g;let match:RegExpExecArray|null;
  while((match=pattern.exec(raw))){
    const start=match.index+match[0].length,end=raw.indexOf("endstream",start);
    if(end<0)break;
    try{parts.push(inflateSync(bytes.subarray(start,end)).toString("latin1"));}catch{/* image or uncompressed stream */}
    pattern.lastIndex=end;
  }
  return parts.join("\n");
}
