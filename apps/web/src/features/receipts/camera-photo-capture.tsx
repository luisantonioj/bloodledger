import {useEffect,useRef,useState} from "react";

// Camera frames and the resulting photo stay in memory on this device.
export function CameraPhotoCapture({onCapture,onClose}:{onCapture:(photo:File)=>void;onClose:()=>void}){
 const video=useRef<HTMLVideoElement>(null),active=useRef(false);
 const [ready,setReady]=useState(false),[capturing,setCapturing]=useState(false),[error,setError]=useState("");
 useEffect(()=>{
  active.current=true;let cancelled=false,stream:MediaStream|undefined;
  const stop=()=>stream?.getTracks().forEach(track=>track.stop());
  async function open(){
   try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("CAMERA_UNAVAILABLE");
    const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}}});
    stream=media;if(cancelled){stop();return;}
    if(video.current){video.current.srcObject=media;await video.current.play();}
   }catch(reason){
    stop();if(cancelled)return;setReady(false);
    setError(reason instanceof DOMException&&["NotAllowedError","SecurityError"].includes(reason.name)?"Camera access was blocked. Allow camera access in your browser, or choose an image.":reason instanceof DOMException&&reason.name==="NotFoundError"?"No camera was found. Connect a camera or choose an image.":"The camera could not open. Check that it is available and use localhost or HTTPS, or choose an image.");
   }
  }
  void open();
  return()=>{cancelled=true;active.current=false;stop();if(video.current)video.current.srcObject=null;};
 },[]);
 function capture(){
  const source=video.current;if(!source||!ready||capturing)return;
  setCapturing(true);setError("");
  try{
   const canvas=document.createElement("canvas"),scale=Math.min(1,4096/Math.max(source.videoWidth,source.videoHeight));
   canvas.width=Math.round(source.videoWidth*scale);canvas.height=Math.round(source.videoHeight*scale);
   const context=canvas.getContext("2d");if(!context)throw Error("CAMERA_FRAME_UNAVAILABLE");
   context.drawImage(source,0,0,canvas.width,canvas.height);
   canvas.toBlob(blob=>{
    if(!active.current)return;
    if(blob){onCapture(new File([blob],"camera-label.jpg",{type:"image/jpeg"}));}
    else{setCapturing(false);setError("The photo could not be captured. Please try again.");}
   },"image/jpeg",.95);
  }catch{setCapturing(false);setError("The photo could not be captured. Please try again.");}
 }
 return <div className="receipt-live-camera">
  <video ref={video} autoPlay muted playsInline aria-label="Live camera preview" onLoadedData={()=>setReady(Boolean(video.current?.videoWidth&&video.current?.videoHeight))}/>
  {error?<p className="receipt-camera-error" role="alert">{error}</p>:!ready&&<p role="status">Opening camera…</p>}
  <div className="receipt-camera-buttons"><button className="button primary compact" type="button" disabled={!ready||capturing} onClick={capture}>{capturing?"Capturing…":"Capture photo"}</button><button className="button compact" type="button" onClick={onClose}>Cancel camera</button></div>
 </div>;
}
