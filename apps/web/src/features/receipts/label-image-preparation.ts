export interface ImagePreparation {rotation:0|90|180|270;crop:{x:number;y:number;width:number;height:number};contrast:"original"|"contrast";deskew:number}
export const defaultPreparation=():ImagePreparation=>({rotation:0,crop:{x:0,y:0,width:100,height:100},contrast:"original",deskew:0});
export function validatePreparation(value:ImagePreparation){
 const {x,y,width,height}=value.crop;
 if(![0,90,180,270].includes(value.rotation)||![x,y,width,height,value.deskew].every(Number.isFinite)||x<0||y<0||width<1||height<1||x+width>100||y+height>100||Math.abs(value.deskew)>10||!["original","contrast"].includes(value.contrast))throw Error("Choose a crop inside the image and a straightening angle between -10 and 10 degrees.");
 return value;
}
export function preparationChanged(value:ImagePreparation){return JSON.stringify(value)!==JSON.stringify(defaultPreparation());}
// Decode/transform locally; neither source nor output is uploaded or persisted.
export async function prepareLabelImage(image:File,settings:ImagePreparation,signal:AbortSignal){
 validatePreparation(settings);signal.throwIfAborted();
 const bitmap=await createImageBitmap(image);
 try{
  if(bitmap.width*bitmap.height>40_000_000)throw Error("Image dimensions are too large; choose a smaller photograph.");
  const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height)),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
  const canvas=document.createElement("canvas");const swapped=settings.rotation===90||settings.rotation===270;canvas.width=swapped?height:width;canvas.height=swapped?width:height;
  const context=canvas.getContext("2d");if(!context)throw Error("Image preparation is unavailable in this browser.");
  context.fillStyle="white";context.fillRect(0,0,canvas.width,canvas.height);context.translate(canvas.width/2,canvas.height/2);context.rotate((settings.rotation+settings.deskew)*Math.PI/180);context.drawImage(bitmap,-width/2,-height/2,width,height);
  const crop=document.createElement("canvas");crop.width=Math.max(1,Math.round(canvas.width*settings.crop.width/100));crop.height=Math.max(1,Math.round(canvas.height*settings.crop.height/100));const out=crop.getContext("2d");if(!out)throw Error("Image crop is unavailable.");
  out.filter=settings.contrast==="contrast"?"grayscale(1) contrast(1.35)":"none";
  out.drawImage(canvas,canvas.width*settings.crop.x/100,canvas.height*settings.crop.y/100,canvas.width*settings.crop.width/100,canvas.height*settings.crop.height/100,0,0,crop.width,crop.height);
  signal.throwIfAborted();const blob=await new Promise<Blob>((resolve,reject)=>crop.toBlob(value=>value?resolve(value):reject(Error("Image crop failed")),"image/png"));signal.throwIfAborted();return new File([blob],"prepared-label.png",{type:"image/png"});
 }finally{bitmap.close();}
}
