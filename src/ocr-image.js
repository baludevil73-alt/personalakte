import {narcoRegions} from './ocr-narco.js';
export function enhancePixels(data){
 const hist=new Uint32Array(256);let visible=0,transparent=0,brightness=0;
 for(let i=0;i<data.length;i+=4){if(data[i+3]<128)transparent++;else{brightness+=.299*data[i]+.587*data[i+1]+.114*data[i+2];visible++;}}
 const background=transparent>data.length/4*.1 && visible && brightness/visible>150?0:255;
 for(let i=0;i<data.length;i+=4){const alpha=data[i+3]/255;const gray=Math.round((.299*data[i]+.587*data[i+1]+.114*data[i+2])*alpha+background*(1-alpha));data[i]=gray;hist[gray]++;}
 const count=data.length/4;
 function percentile(fraction){let sum=0;for(let n=0;n<256;n++){sum+=hist[n];if(sum>=count*fraction)return n;}return 255;}
 const low=percentile(.02),high=percentile(.98),invert=percentile(.5)<128,span=high-low;
 for(let i=0;i<data.length;i+=4){let value=span>20?Math.max(0,Math.min(255,Math.round((data[i]-low)*255/span))):data[i];if(invert)value=255-value;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;}
 return data;
}
export function imageRegion(width,height,template){
 const left=template==='narco' && width/height>=1.5 && width/height<=2.1?Math.round(width*.33):0;
 return {left,top:0,width:width-left,height};
}
export async function prepareOcrImage(blob,{template='whole'}={}){
 let source,cleanup=()=>{};
 if(typeof createImageBitmap==='function'){source=await createImageBitmap(blob);cleanup=()=>source.close();}
 else{const url=URL.createObjectURL(blob);source=new Image();source.src=url;try{await source.decode();}catch(error){URL.revokeObjectURL(url);throw error;}cleanup=()=>URL.revokeObjectURL(url);}
 try{
  if(!source.width || !source.height || source.width*source.height>40000000)throw new Error('Das Bild ist zu groß. Bitte nur den Ausweis ausschneiden.');
  if(template==='narco' && source.width/source.height>=1.5 && source.width/source.height<=2.1){
   const regions=[];
   for(const region of narcoRegions){
    const left=Math.round(source.width*region.x),top=Math.round(source.height*region.y);
    const width=Math.min(source.width-left,Math.round(source.width*region.width)),height=Math.min(source.height-top,Math.round(source.height*region.height));
    const scale=Math.min(6,Math.max(2,96/height)),padding=16;
    const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Bildaufbereitung nicht verfügbar.');
    ctx.imageSmoothingEnabled=false;ctx.drawImage(source,left,top,width,height,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    for(let i=0;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=pixels.data[i+region.channel];
    enhancePixels(pixels.data);ctx.putImageData(pixels,0,0);
    const framed=document.createElement('canvas');framed.width=canvas.width+padding*2;framed.height=canvas.height+padding*2;
    const frame=framed.getContext('2d');frame.fillStyle='#fff';frame.fillRect(0,0,framed.width,framed.height);frame.drawImage(canvas,padding,padding);canvas.width=canvas.height=1;
    regions.push({...region,image:framed});
   }
   return {regions,release:()=>{for(const region of regions)region.image.width=region.image.height=1;}};
  }
  const region=imageRegion(source.width,source.height,template),width=region.width,height=region.height;
  if(!width || !height || width*height>40000000)throw new Error('Das Bild ist zu groß. Bitte nur den Ausweis ausschneiden.');
  const scale=Math.min(Math.max(1,2400/Math.max(width,height)),Math.sqrt(6000000/(width*height)));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Bildaufbereitung nicht verfügbar.');
  context.drawImage(source,region.left,region.top,width,height,0,0,canvas.width,canvas.height);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height);enhancePixels(pixels.data);context.putImageData(pixels,0,0);
  const alternate=document.createElement('canvas');alternate.width=canvas.width;alternate.height=canvas.height;
  const second=alternate.getContext('2d');if(!second)throw new Error('Bildaufbereitung nicht verfügbar.');
  for(let i=0;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255-pixels.data[i];
  second.putImageData(pixels,0,0);
  return {image:canvas,alternate,release:()=>{canvas.width=canvas.height=alternate.width=alternate.height=1;}};
 }finally{cleanup();}
}
