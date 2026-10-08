(() => {
  'use strict';
  const cache=new WeakMap(),targets=new WeakMap(),{check}=Raben;
  const variants=async file=>{
    await RabenMedia.validateFile(file,false);
    if(cache.has(file))return cache.get(file);
    const promise=(async()=>{
      if(!window.createImageBitmap)return [];
      const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      try{
        const files=[];
        for(const width of [640,1440]){
          const ratio=Math.min(1,width/bitmap.width),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
          const ctx=canvas.getContext('2d');if(!ctx)throw new Error('image_processing_failed');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.83));if(!blob)throw new Error('image_processing_failed');
          files.push(new File([blob],`vorschau-${width}.webp`,{type:blob.type||'image/webp'}));
        }return files;
      }finally{bitmap.close();}
    })();cache.set(file,promise);try{return await promise;}catch(e){cache.delete(file);throw e;}
  };
  const upload=async(ctx,file,controls,bucket='raben-media',target=null)=>{
    const previews=await variants(file),imagePath=await RabenMedia.upload(ctx,file,ctx.actor.user_id,controls,false,target,bucket),paths=[];
    for(const preview of previews){let target=null;if(bucket==='raben-public'){target=targets.get(preview);if(!target){target=crypto.randomUUID()+'.'+(preview.type==='image/webp'?'webp':'png');targets.set(preview,target);}}paths.push(await RabenMedia.upload(ctx,preview,ctx.actor.user_id,controls,false,target,bucket));}
    return {imagePath,thumbPath:paths[0]||null,mediumPath:paths[1]||paths[0]||null};
  };
  const publicUrl=path=>path?Raben.client().storage.from('raben-public').getPublicUrl(path).data.publicUrl:'';
  const background=async(ctx,file,controls,target)=>{
    const result=await upload(ctx,file,controls,'raben-public',target);return {original:publicUrl(result.imagePath),small:publicUrl(result.thumbPath),medium:publicUrl(result.mediumPath)};
  };
  const uploadPreviews=async(ctx,file,controls,bucket='raben-public')=>{const paths=[];for(const preview of await variants(file)){let target=targets.get(preview);if(bucket==='raben-public'&&!target){target=crypto.randomUUID()+'.'+(preview.type==='image/webp'?'webp':'png');targets.set(preview,target);}paths.push(await RabenMedia.upload(ctx,preview,ctx.actor.user_id,controls,false,bucket==='raben-public'?target:null,bucket));}return {small:publicUrl(paths[0]),medium:publicUrl(paths[1]||paths[0])};};
  window.RabenPictures={variants,upload,background,uploadPreviews};
})();
