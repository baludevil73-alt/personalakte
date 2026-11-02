export function cropRectangle(start,end,width,height){
 const x=Math.max(0,Math.min(width,Math.min(start.x,end.x))),y=Math.max(0,Math.min(height,Math.min(start.y,end.y)));
 return {x,y,width:Math.max(0,Math.min(width,Math.max(start.x,end.x))-x),height:Math.max(0,Math.min(height,Math.max(start.y,end.y))-y)};
}
export function createCropView(canvas){
 let source=null,selection=null,start=null,version=0;
 const context=canvas.getContext('2d');
 function draw(){if(!source)return;context.drawImage(source,0,0,canvas.width,canvas.height);if(selection){context.strokeStyle='#ffd873';context.lineWidth=3;context.strokeRect(selection.x,selection.y,selection.width,selection.height);}}
 function point(event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};}
 canvas.onpointerdown=event=>{if(!source)return;start=point(event);selection=null;canvas.setPointerCapture(event.pointerId);draw();};
 canvas.onpointermove=event=>{if(!start)return;selection=cropRectangle(start,point(event),canvas.width,canvas.height);draw();};
 canvas.onpointerup=event=>{if(!start)return;selection=cropRectangle(start,point(event),canvas.width,canvas.height);start=null;if(selection.width<20||selection.height<20)selection=null;draw();};
 canvas.onpointercancel=()=>{start=null;selection=null;draw();};
 return {
  clear(){version++;source?.close();source=null;selection=null;start=null;canvas.hidden=true;canvas.width=canvas.height=1;},
  reset(){selection=null;start=null;draw();},
  async load(blob){const request=++version;source?.close();source=null;selection=null;canvas.hidden=true;const decoded=await createImageBitmap(blob);if(request!==version){decoded.close();return;}source=decoded;const scale=Math.min(1,1000/source.width);canvas.width=Math.round(source.width*scale);canvas.height=Math.round(source.height*scale);canvas.hidden=false;draw();},
  async image(original){if(!source||!selection)return original;const output=document.createElement('canvas'),scale=source.width/canvas.width;output.width=Math.round(selection.width*scale);output.height=Math.round(selection.height*scale);output.getContext('2d').drawImage(source,selection.x*scale,selection.y*scale,selection.width*scale,selection.height*scale,0,0,output.width,output.height);return new Promise((resolve,reject)=>output.toBlob(blob=>{output.width=output.height=1;blob?resolve(blob):reject(new Error('Zuschnitt fehlgeschlagen.'));},'image/png'));}
 };
}
