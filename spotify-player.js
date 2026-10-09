(() => {
  'use strict';
  const {el}=Raben,players=new Set();let api=null,loading=null;
  const preference=()=>{try{return localStorage.getItem('raben-spotify-autoplay')==='1';}catch(_){return false;}};
  const setAutoplay=value=>{try{localStorage.setItem('raben-spotify-autoplay',value?'1':'0');}catch(_){}if(!value)for(const player of players)if(player.automatic)player.controller?.pause?.();};
  const loadAPI=()=>{
    if(api)return Promise.resolve(api);if(loading)return loading;
    loading=new Promise((resolve,reject)=>{
      const previous=window.onSpotifyIframeApiReady,script=el('script','');let finished=false;
      const fail=()=>{if(finished)return;finished=true;clearTimeout(timer);loading=null;script.remove();reject(new Error('spotify_unavailable'));};
      const timer=setTimeout(fail,12000);
      window.onSpotifyIframeApiReady=value=>{api=value;if(typeof previous==='function')try{previous(value);}catch(_){}if(finished)return;finished=true;clearTimeout(timer);resolve(value);};
      script.src='https://open.spotify.com/embed/iframe-api/v1';script.async=true;script.addEventListener('error',fail);document.head.append(script);
    });return loading;
  };
  const button=(text,fn)=>{const b=el('button','button outline small-button',text);b.type='button';b.addEventListener('click',fn);return b;};
  const allowed=source=>['track','playlist'].includes(source.type)&&/^[A-Za-z0-9]{22}$/.test(source.id||'');
  const create=(ctx,source)=>{
    const wrap=el('section','spotify-player');if(!allowed(source))return wrap;
    const epoch=ctx.epoch,embed=el('div','spotify-embed-host'),status=el('p','field-note spotify-status','Spotify wird erst auf Wunsch geladen.'),actions=el('div','spotify-actions');status.setAttribute('aria-live','polite');ctx.spotifyPlayers ||=new Set();ctx.players ||=new Set();
    const state={ctx,epoch,controller:null,disposed:false,automatic:false,ready:false,loading:false,frame:null};players.add(state);ctx.spotifyPlayers.add(state);
    const live=()=>!state.disposed&&!ctx.disposed&&ctx.epoch===epoch&&wrap.isConnected;
    const authorize=async()=>{if(!ctx.public)await ctx.authorize();if(!live())throw new Error('spotify_disposed');};
    const play=()=>{
      if(!live()||!state.controller)return;
      for(const other of players)if(other!==state)other.controller?.pause?.();
      try{const result=state.controller.play();if(result?.catch)result.catch(()=>{if(live())status.textContent='Bitte starte die Musik mit ▶ im Spotify-Player.';});status.textContent='Start angefordert. Falls die Musik nicht startet, drücke ▶ im Spotify-Player.';}catch(_){status.textContent='Bitte starte die Musik mit ▶ im Spotify-Player.';}
    };
    const load=async(automatic=false)=>{
      if(state.loading||state.controller)return;state.loading=true;state.automatic=automatic;start.disabled=true;status.textContent='Spotify-Player wird geladen …';
      try{await authorize();}catch(_){state.loading=false;start.disabled=false;if(live())status.textContent='Der Player ist nicht mehr verfügbar. Bitte aktualisiere den Bereich.';return;}
      try{
        const API=await loadAPI();if(!live())return;const target=el('div','');embed.replaceChildren(target);
        API.createController(target,{uri:'spotify:'+source.type+':'+source.id,width:'100%',height:source.type==='playlist'&&!source.compact?352:152},controller=>{
          if(!live()){controller.destroy?.();return;}state.controller=controller;start.disabled=false;start.textContent='Musik starten';pause.hidden=false;
          const frame=embed.querySelector('iframe');if(frame){frame.classList.add('media-spotify');frame.title=(source.title||'Begleitmusik')+' · Spotify';frame.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');frame.referrerPolicy='strict-origin-when-cross-origin';state.frame=frame;ctx.players.add(frame);}
          status.textContent='Spotify bereit. Drücke ▶, wenn die Musik nicht automatisch startet.';
          controller.addListener('ready',()=>{if(!live())return;state.ready=true;if(!automatic||preference())if(source.autoplay!==false)play();});
          controller.addListener('playback_started',()=>{if(!live())return;for(const other of players)if(other!==state)other.controller?.pause?.();status.textContent='Musik läuft.';});
          controller.addListener('playback_update',event=>{if(!live())return;const data=event.data||{};status.textContent=data.isBuffering?'Musik wird geladen …':data.isPaused?'Musik pausiert.':'Musik läuft.';});
        });
      }catch(_){
        if(!live())return;const frame=el('iframe','media-spotify');frame.src='https://open.spotify.com/embed/'+source.type+'/'+source.id+'?utm_source=generator&theme=0';frame.title=(source.title||'Begleitmusik')+' · Spotify';frame.height=source.type==='playlist'&&!source.compact?'352':'152';frame.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');frame.referrerPolicy='strict-origin-when-cross-origin';embed.replaceChildren(frame);state.frame=frame;ctx.players.add(frame);status.textContent='Drücke ▶ im Spotify-Player, um die Musik zu starten.';start.textContent='Spotify erneut laden';start.disabled=false;
      }finally{state.loading=false;}
    };
    const start=button('Spotify laden',async()=>{try{if(state.controller){await authorize();play();}else await load(false);}catch(_){if(live())status.textContent='Der Player ist nicht mehr verfügbar. Bitte aktualisiere den Bereich.';}}),pause=button('Pausieren',()=>{state.controller?.pause?.();status.textContent='Musik pausiert.';});pause.hidden=true;
    // A separate switch retains a usable opt-out after the player has loaded.
    const remember=el('label','spotify-consent'),checkbox=el('input','');checkbox.type='checkbox';checkbox.checked=preference();remember.append(checkbox,document.createTextNode('Spotify künftig auf diesem Gerät automatisch laden und starten'));
    checkbox.addEventListener('change',()=>{setAutoplay(checkbox.checked);if(checkbox.checked){if(state.controller)play();else load(false);}else status.textContent='Autostart ausgeschaltet. Du kannst die Musik manuell starten.';});
    actions.append(start,pause);wrap.append(embed,actions,status,remember,el('p','field-note','Die Wiedergabe richtet sich nach Spotify und deinem Browser. Autostart kann einen ersten Klick benötigen.'));
    state.dispose=()=>{if(state.disposed)return;state.disposed=true;try{state.controller?.destroy?.();}catch(_){}finally{if(state.frame){ctx.players.delete(state.frame);state.frame.remove();}ctx.spotifyPlayers.delete(state);players.delete(state);}};
    if(source.autoplay!==false&&preference()&&!ctx.spotifyAutoClaim){ctx.spotifyAutoClaim=true;Promise.resolve().then(()=>load(true));}
    return wrap;
  };
  const release=ctx=>{for(const player of [...ctx.spotifyPlayers||[]])player.dispose();delete ctx.spotifyAutoClaim;};
  const home=(ctx,source)=>{
    document.getElementById('home-spotify-player')?.remove();if(!source?.enabled||!allowed(source))return;
    const dock=el('aside','site-music'),head=el('div','site-music-heading'),panel=create(ctx,{...source,compact:true});dock.id='home-spotify-player';dock.setAttribute('aria-label','Spotify-Begleitmusik');head.append(el('h2','',source.title||'Begleitmusik'));
    const minimize=button('Einklappen',()=>{panel.hidden=!panel.hidden;minimize.textContent=panel.hidden?'Musikplayer öffnen':'Einklappen';minimize.setAttribute('aria-expanded',String(!panel.hidden));});minimize.setAttribute('aria-expanded','true');head.append(minimize);dock.append(head,panel);document.body.append(dock);
  };
  window.RabenSpotify={create,home,release,preference,setAutoplay};
  window.addEventListener('raben-lock',()=>{for(const player of [...players])if(!player.ctx.public)player.dispose();});
})();
