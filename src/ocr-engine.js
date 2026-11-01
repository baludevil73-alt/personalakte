let apiPromise;
export function loadOcrApi(){
 if(apiPromise)return apiPromise;
 apiPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/ocr/v7/tesseract.min.js';script.async=true;
  script.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(new Error('Texterkennung konnte nicht geladen werden.'));
  script.onerror=()=>{script.remove();apiPromise=null;reject(new Error('Texterkennung konnte nicht geladen werden. Bitte später erneut versuchen.'));};
  document.head.append(script);
 });return apiPromise;
}
export function createLocalRecognizer({loadApi=loadOcrApi,timeoutMs=90000}={}){
 let stopActive=()=>{};
 return {
  cancel(){stopActive();},
  async recognize(image,onProgress=()=>{}){
   stopActive();
   let stopped=false,worker=null,rejectStop;
   const aborted=()=>Object.assign(new Error('Erkennung abgebrochen.'),{name:'AbortError'});
   const stopPromise=new Promise((_,reject)=>{rejectStop=reject;});
   function stop(error=aborted()){
    if(stopped)return;stopped=true;rejectStop(error);
    if(worker)void worker.terminate().catch(()=>{});
   }
   stopActive=()=>stop();
   const timer=setTimeout(()=>stop(new Error('Die Erkennung dauert zu lange. Bitte ein scharfes, zugeschnittenes Bild verwenden.')),timeoutMs);
   const run=async()=>{
    const api=await loadApi();if(stopped)throw aborted();
    worker=await api.createWorker(['deu','eng'],1,{
     workerPath:new URL('/ocr/v7/worker.min.js',location.origin).href,
     corePath:new URL('/ocr/v7/core',location.origin).href,
     langPath:'https://tessdata.projectnaptha.com/4.0.0',
     workerBlobURL:false,cacheMethod:'write',
     logger:message=>{if(!stopped)onProgress(message.status,Number.isFinite(message.progress)?message.progress:0);}
    });
    if(stopped){await worker.terminate();throw aborted();}
    await worker.setParameters({tessedit_pageseg_mode:api.PSM.SPARSE_TEXT,preserve_interword_spaces:'1'});
    if(stopped)throw aborted();
    const result=await worker.recognize(image);
    if(stopped)throw aborted();
    return {text:result.data.text ?? '',confidence:result.data.confidence};
   };
   try{return await Promise.race([run(),stopPromise]);}
   finally{clearTimeout(timer);if(worker)void worker.terminate().catch(()=>{});if(!stopped)stopped=true;}
  }
 };
}
