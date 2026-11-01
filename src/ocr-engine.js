import {prepareOcrImage} from './ocr-image.js';
import {parseIdentityText} from './ocr-parse.js';
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
export function createLocalRecognizer({loadApi=loadOcrApi,prepareImage=prepareOcrImage,timeoutMs=120000}={}){
 let stopActive=()=>{};
 return {
  cancel(){stopActive();},
  async recognize(image,onProgress=()=>{},settings={}){
   stopActive();
   let stopped=false,worker=null,rejectStop,prepared=null;
   const aborted=()=>Object.assign(new Error('Erkennung abgebrochen.'),{name:'AbortError'});
   const stopPromise=new Promise((_,reject)=>{rejectStop=reject;});
   function stop(error=aborted()){
    if(stopped)return;stopped=true;rejectStop(error);
    if(worker)void worker.terminate().catch(()=>{});
   }
   stopActive=()=>stop();
   const timer=setTimeout(()=>stop(new Error('Die Erkennung dauert zu lange. Bitte ein scharfes, zugeschnittenes Bild verwenden.')),timeoutMs);
   const run=async()=>{
    onProgress('preparing image',0);prepared=await prepareImage(image,settings);
    if(stopped){prepared.release();throw aborted();}
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
    let result=await worker.recognize(prepared.image);
    if(stopped)throw aborted();
    // Dünne Beschriftungen und Kartenlayouts werden oft mit einem Textblock besser erkannt.
    if(Object.keys(parseIdentityText(result.data.text ?? '')).length<4){
     onProgress('second pass',0);
     await worker.setParameters({tessedit_pageseg_mode:prepared.alternate?api.PSM.SPARSE_TEXT:api.PSM.SINGLE_BLOCK ?? 6,preserve_interword_spaces:'1'});
     if(stopped)throw aborted();
     const alternate=await worker.recognize(prepared.alternate ?? prepared.image);if(stopped)throw aborted();
     // Unterschiedliche Schriftfarben können unterschiedliche Felder liefern.
     result={data:{text:[result.data.text,alternate.data.text].filter(value=>value?.trim()).filter((value,index,all)=>all.indexOf(value)===index).join('\n\n'),confidence:alternate.data.confidence}};
    }
    prepared.release();prepared=null;
    return {text:result.data.text ?? '',confidence:result.data.confidence};
   };
   try{return await Promise.race([run(),stopPromise]);}
   finally{clearTimeout(timer);if(prepared){prepared.release();prepared=null;}if(worker)void worker.terminate().catch(()=>{});if(!stopped)stopped=true;}
  }
 };
}
