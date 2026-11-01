import {prepareOcrImage} from './ocr-image.js';
import {parseIdentityText} from './ocr-parse.js';
import {regionValue,narcoSuggestions} from './ocr-narco.js';
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
    if(prepared.regions){
     const results={};
     for(const region of prepared.regions){
      if(stopped)throw aborted();onProgress('region '+region.key,0);
      const whitelist=region.key==='birth_date'?'0123456789./-':region.key==='height_cm'?'0123456789':region.key==='identity_number'?'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789':'';
      await worker.setParameters({tessedit_pageseg_mode:api.PSM.SINGLE_LINE ?? 7,tessedit_char_whitelist:whitelist});
      let result=await worker.recognize(region.image);if(stopped)throw aborted();
      if(!regionValue(region.key,result.data.text) || result.data.confidence<65){
       await worker.setParameters({tessedit_pageseg_mode:api.PSM.RAW_LINE ?? 13,tessedit_char_whitelist:whitelist});
       const alternative=await worker.recognize(region.image);if(stopped)throw aborted();
       const score=value=>(regionValue(region.key,value.data.text)?1000:0)+(value.data.confidence || 0);
       if(score(alternative)>score(result))result=alternative;
      }
      results[region.key]={text:result.data.text ?? '',confidence:result.data.confidence,label:region.label};
     }
     prepared.release();prepared=null;
     return {text:Object.values(results).filter(result=>result.text.trim()).map(result=>result.label+':\n'+result.text.trim()).join('\n\n'),values:narcoSuggestions(results)};
    }
    await worker.setParameters({tessedit_pageseg_mode:api.PSM.SPARSE_TEXT,preserve_interword_spaces:'1'});
    if(stopped)throw aborted();
    let result=await worker.recognize(prepared.image);
    if(stopped)throw aborted();
    // Dünne Beschriftungen und Kartenlayouts werden oft mit einem Textblock besser erkannt.
    if(Object.keys(parseIdentityText(result.data.text ?? '')).length<6){
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
