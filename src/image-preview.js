export function createImagePreview({load,isCurrent,onError,label}) {
 const button=document.createElement('button');button.type='button';button.textContent='Bild ansehen';
 const view=document.createElement('figure');view.className='image-preview';view.hidden=true;
 const image=document.createElement('img');image.alt=label;image.decoding='async';view.append(image);
 let url=null,version=0;
 function clear() {
  version++;image.removeAttribute('src');view.hidden=true;button.textContent='Bild ansehen';button.disabled=false;
  if(url){URL.revokeObjectURL(url);url=null;}
 }
 image.onerror=()=>{clear();onError('Das Bild kann nicht angezeigt werden. Bitte eine gültige Bilddatei verwenden.');};
 button.onclick=async()=>{
  if(!view.hidden){clear();return;}
  const request=++version;button.disabled=true;button.textContent='Bild wird geladen …';
  try {
   // Jede neue Vorschau über die geschützte API abrufen, niemals Storage-URL einbetten.
   const blob=await load();
   if(request!==version || !isCurrent()) return;
   if(!['image/png','image/jpeg','image/webp'].includes(blob.type)) throw new Error('Dieses Dateiformat kann nicht als Bild angezeigt werden.');
   url=URL.createObjectURL(blob);image.src=url;view.hidden=false;button.textContent='Bild schließen';
  }catch(error){if(request===version){clear();onError(error.message);}}
  finally{if(request===version){button.disabled=false;if(view.hidden)button.textContent='Bild ansehen';}}
 };
 return {button,view,clear};
}
