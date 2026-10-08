(() => {
  'use strict';
  const {el,check}=Raben;
  const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
  const dates=(details,from=day(),limit=80)=>{
    const result=[],start=details.date;if(!start)return result;
    const until=details.repeat&&details.repeat!=='none'?details.repeatUntil||start:start;
    const date=new Date(start+'T12:00:00Z');for(let n=0;n<740&&result.length<limit;n++){
      const value=date.toISOString().slice(0,10);if(value>until)break;
      const delta=Math.round((date-new Date(start+'T12:00:00Z'))/86400000);
      if((value===start||details.repeat==='weekly'&&delta%7===0||details.repeat==='fortnightly'&&delta%14===0||details.repeat==='monthly'&&date.getUTCDate()===Number(start.slice(-2)))&&value>=from)result.push(value);
      date.setUTCDate(date.getUTCDate()+1);
    }return result;
  };
  const escape=value=>String(value??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const fold=line=>{let result='',part='',length=0;for(const char of line){const bytes=new TextEncoder().encode(char).length;if(length+bytes>75){result+=part+'\r\n';part=' ';length=1;}part+=char;length+=bytes;}return result+part;};
  const ics=rows=>{
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Schwarze Raben//Clan Kalender//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VTIMEZONE','TZID:Europe/Berlin','BEGIN:DAYLIGHT','DTSTART:19700329T020000','TZOFFSETFROM:+0100','TZOFFSETTO:+0200','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:19701025T030000','TZOFFSETFROM:+0200','TZOFFSETTO:+0100','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','END:STANDARD','END:VTIMEZONE'];
    for(const row of rows){const d=row.details||{};if(!d.date)continue;const start=(d.date+'T'+(d.time||'20:00').replace(':','')+'00').replaceAll('-','');const endDate=new Date(d.date+'T'+(d.time||'20:00')+':00Z');endDate.setUTCMinutes(endDate.getUTCMinutes()+Number(d.duration||120));
      lines.push('BEGIN:VEVENT','UID:'+row.id+'@schwarze-raben','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z'),'DTSTART;TZID=Europe/Berlin:'+start,'DTEND;TZID=Europe/Berlin:'+endDate.toISOString().slice(0,19).replace(/[-:]/g,''),'SUMMARY:'+escape(row.title),'DESCRIPTION:'+escape(row.body),'LOCATION:'+escape(d.location),'STATUS:'+(d.cancelled?'CANCELLED':'CONFIRMED'));
      if(d.repeat&&d.repeat!=='none'&&d.repeatUntil){let rule=d.repeat==='monthly'?'FREQ=MONTHLY;BYMONTHDAY='+Number(d.date.slice(-2)):'FREQ=WEEKLY;INTERVAL='+(d.repeat==='fortnightly'?2:1);const until=new Date(d.repeatUntil+'T23:59:59Z');lines.push('RRULE:'+rule+';UNTIL='+until.toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z'));}
      if(d.exceptions?.length)lines.push('EXDATE;TZID=Europe/Berlin:'+d.exceptions.map(date=>date.replaceAll('-','')+'T'+(d.time||'20:00').replace(':','')+'00').join(','));lines.push('END:VEVENT');
    }lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
  };
  const download=(ctx,rows)=>{const url=URL.createObjectURL(new Blob([ics(rows)],{type:'text/calendar;charset=utf-8'}));ctx.urls.add(url);const a=el('a','','Kalender herunterladen');a.href=url;a.download='schwarze-raben.ics';document.body.append(a);a.click();a.remove();};
  const editor=(grid,d,field)=>{
    const inputs={};[['repeat','Wiederholung','select',[['none','Einmalig'],['weekly','Wöchentlich'],['fortnightly','Alle zwei Wochen'],['monthly','Monatlich']]],['repeatUntil','Wiederholen bis','date'],['capacity','Plätze · leer für unbegrenzt','number'],['duration','Dauer in Minuten','number'],['cancelled','Terminserie abgesagt','checkbox'],['exceptions','Einzelne Ausfälle · ein Datum JJJJ-MM-TT je Zeile','textarea']].forEach(([key,label,type,options])=>{
      const f=field(label,type,key==='exceptions'?(d.exceptions||[]).join('\n'):d[key]??(key==='repeat'?'none':key==='duration'?120:key==='cancelled'?false:''),options||[]);if(type==='number'){f.input.min=key==='duration'?15:1;f.input.max=key==='duration'?1440:500;f.input.step=1;}inputs[key]=f.input;grid.append(f.wrap);
    });return {read:()=>{const out={repeat:inputs.repeat.value,cancelled:inputs.cancelled.checked,duration:Number(inputs.duration.value)||120,exceptions:inputs.exceptions.value.split(/\s+/).filter(Boolean)};if(inputs.capacity.value)out.capacity=Number(inputs.capacity.value);if(out.repeat!=='none'){out.repeatUntil=inputs.repeatUntil.value;if(!out.repeatUntil)throw new Error('repeat_until_required');}return out;}};
  };
  const render=async(ctx,row,card)=>{
    const epoch=ctx.epoch,d=row.details||{},area=el('section','hub-interactions'),select=el('select','');select.setAttribute('aria-label','Termin auswählen');
    const occurrences=dates(d,day(),80);if(!occurrences.length)occurrences.push(d.date);
    occurrences.forEach(date=>{const o=el('option','',date+(d.exceptions?.includes(date)?' · abgesagt':''));o.value=date;select.append(o);});
    const exportButton=el('button','button outline small-button','ICS herunterladen');exportButton.type='button';exportButton.addEventListener('click',()=>download(ctx,[row]));area.append(select,exportButton);const content=el('div','');area.append(content);card.append(area);
    const draw=async()=>{
      await ctx.authorize();const date=select.value,rows=await check(Raben.client().from('raben_event_slots').select('user_id,choice,wait_since').eq('record_id',row.id).eq('occurrence_date',date).order('wait_since'));
      if(ctx.disposed||ctx.epoch!==epoch||!area.isConnected)return;content.replaceChildren();const closed=d.cancelled||d.exceptions?.includes(date)||d.registrationOpen===false||date<day(),mine=rows.find(r=>r.user_id===ctx.actor.user_id),actions=el('div','hub-inline-actions');
      content.append(el('p','field-note',closed?'Termin abgesagt oder Anmeldung geschlossen':rows.filter(r=>r.choice==='yes').length+' Zusagen'+(d.capacity?' / '+d.capacity+' Plätze':'')+' · '+rows.filter(r=>r.choice==='wait').length+' auf der Warteliste'));
      for(const [choice,label] of [['yes','Dabei'],['maybe','Vielleicht'],['no','Absage']]){const b=el('button','button outline small-button',label);b.type='button';b.disabled=closed;b.setAttribute('aria-pressed',String(mine?.choice===choice||choice==='yes'&&mine?.choice==='wait'));b.addEventListener('click',async()=>{b.disabled=true;try{await ctx.authorize();await check(Raben.client().rpc('raben_event_respond_on',{p_record:row.id,p_choice:choice,p_date:date}));await draw();}catch(e){ctx.report(Raben.errorMessage(e),true);}finally{b.disabled=closed;}});actions.append(b);}content.append(actions);
      if(mine?.choice==='wait')content.append(el('p','status-message','Du stehst auf der Warteliste und rückst bei einem freien Platz automatisch nach.'));
      const details=el('details','');details.append(el('summary','','Teilnahmen ansehen'));rows.forEach(r=>{const p=el('p','field-note');p.append(RabenIdentity.person(ctx,r.user_id,{suffix:' · '+({yes:'Dabei',maybe:'Vielleicht',no:'Absage',wait:'Warteliste'}[r.choice])}));details.append(p);});content.append(details);
    };select.addEventListener('change',()=>draw().catch(e=>ctx.report(Raben.errorMessage(e),true)));await draw();
  };
  window.RabenCalendar={dates,ics,editor,render,download,day};
})();
