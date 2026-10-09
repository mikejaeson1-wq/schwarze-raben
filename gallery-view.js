(() => {
 'use strict';const {el,check}=Raben;let modal=null;
 const live=(ctx,e)=>!ctx.disposed&&ctx.epoch===e;
 const button=(text,fn)=>{const b=el('button','button outline small-button',text);b.type='button';b.addEventListener('click',fn);return b;};
 const close=ctx=>{if(modal&&(!ctx||modal.ctx===ctx)){const current=modal;modal=null;current.dialog.close?.();current.dialog.remove();if(current.url){URL.revokeObjectURL(current.url);current.ctx.urls.delete(current.url);}current.focus?.focus?.();}};
 const open=async(ctx,{bucket='raben-profile-media',path,title='',publicUrl=''})=>{
  const e=ctx.epoch;close();const dialog=el('dialog','image-lightbox'),top=el('div','lightbox-toolbar'),area=el('div','lightbox-stage'),status=el('p','field-note','Bild wird geladen …');dialog.setAttribute('aria-label',title||'Großbildansicht');const focus=document.activeElement;top.append(el('h2','',title||'Bildansicht'),button('Schließen',()=>close(ctx)));area.append(status);dialog.append(top,area);document.body.append(dialog);modal={ctx,dialog,focus,url:null};if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
  dialog.addEventListener('close',()=>close(ctx));dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close(ctx);}});dialog.addEventListener('click',event=>{if(event.target===dialog)close(ctx);});
  try{
   let src=publicUrl;if(!src){await ctx.authorize();const blob=await check(Raben.client().storage.from(bucket).download(path));if(!live(ctx,e)||modal?.dialog!==dialog)return;src=URL.createObjectURL(blob);ctx.urls.add(src);modal.url=src;}
   if(!live(ctx,e)||modal?.dialog!==dialog)return;const image=el('img','lightbox-image');image.src=src;image.alt=title||'Bild in Großansicht';image.addEventListener('error',()=>status.textContent='Das Originalbild konnte nicht geladen werden.');image.addEventListener('load',()=>status.remove());area.append(image);
   const zoom=()=>area.classList.toggle('is-zoomed');top.append(button('Vergrößern / Einpassen',zoom));image.addEventListener('dblclick',zoom);top.querySelector('button')?.focus();
  }catch(error){if(live(ctx,e)&&modal?.dialog===dialog)status.textContent=Raben.errorMessage(error);}
 };
 const image=async(ctx,path,host,title='')=>{const e=ctx.epoch;try{const blob=await check(Raben.client().storage.from('raben-profile-media').download(path));if(!live(ctx,e)||!host.isConnected)return;const url=URL.createObjectURL(blob);ctx.urls.add(url);const img=el('img','hub-image');img.src=url;img.alt=title||'Charakterbild';img.loading='lazy';host.prepend(img);}catch(_){}};
 const figure=(ctx,row,item)=>{
  const e=ctx.epoch,f=el('figure','character-image');f.dataset.profileImage=row.id;let title=row.display_title||'';const caption=el('figcaption','field-note',title);caption.hidden=!title;
  f.append(caption,button('Original ansehen',()=>open(ctx,{path:row.image_path,title})));image(ctx,row.preview_path||row.image_path,f,title);RabenExpansion.comments(ctx,'profile_image',row.id,f,item.owner_id);
  if(item.owner_id===ctx.actor.user_id){
   const edit=()=>{if(f.querySelector('.image-title-editor'))return;const form=el('form','image-title-editor'),wrap=el('label','form-field','Eigener Bildtitel · leer lassen zum Ausblenden'),input=el('input','');input.type='text';input.maxLength=120;input.value=title;wrap.append(input);const save=el('button','button outline small-button','Bildtitel speichern');save.type='submit';form.append(wrap,save,button('Abbrechen',()=>form.remove()));f.append(form);input.focus();
    form.addEventListener('submit',async event=>{event.preventDefault();if(save.disabled)return;save.disabled=true;try{await ctx.authorize();const value=input.value.trim(),changed=await check(Raben.client().from('raben_profile_gallery').update({display_title:value}).eq('id',row.id).eq('display_title',title).select('id'));if(!changed.length)throw new Error('profile_conflict');if(!live(ctx,e))return;title=value;row.display_title=value;caption.textContent=value;caption.hidden=!value;form.remove();ctx.report('Bildtitel gespeichert.');}catch(error){if(live(ctx,e))ctx.report(RabenProfiles.errorMessage(error),true);}finally{save.disabled=false;}});
   };
   const menu=button('⋯',edit);menu.setAttribute('aria-label','Bildtitel ändern');menu.classList.add('image-title-menu');f.append(menu);f.addEventListener('contextmenu',event=>{event.preventDefault();edit();});
  }return f;
 };
 window.RabenGallery={open,close,figure,image};window.addEventListener('raben-lock',()=>close());
})();
