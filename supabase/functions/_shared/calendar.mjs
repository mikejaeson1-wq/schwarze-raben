export const escapeICS=value=>String(value??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
export const foldICS=line=>{let result='',part='',length=0;for(const char of line){const bytes=new TextEncoder().encode(char).length;if(length+bytes>75){result+=part+'\r\n';part=' ';length=1;}part+=char;length+=bytes;}return result+part;};
export function calendarICS(rows,title='Schwarze Raben',now=new Date()){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Schwarze Raben//Clan Kalender//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+escapeICS(title),'BEGIN:VTIMEZONE','TZID:Europe/Berlin','BEGIN:DAYLIGHT','DTSTART:19700329T020000','TZOFFSETFROM:+0100','TZOFFSETTO:+0200','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:19701025T030000','TZOFFSETFROM:+0200','TZOFFSETTO:+0100','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','END:STANDARD','END:VTIMEZONE'];
 const stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
 for(const row of rows){const d=row.details||{};if(!/^\d{4}-\d\d-\d\d$/.test(d.date||''))continue;const baseTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time||'')?d.time:'20:00',recurring=d.repeat&&d.repeat!=='none'&&d.repeatUntil;
  const emit=(original,date,time,duration,{attending=false,override=false,rule=false}={})=>{
   const uid=row.id+(attending?'-'+original:'')+'@schwarze-raben';lines.push('BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+stamp,'SEQUENCE:'+Math.max(0,Number(row.revision)||0));
   if(override)lines.push('RECURRENCE-ID;TZID=Europe/Berlin:'+original.replaceAll('-','')+'T'+baseTime.replace(':','')+'00');
   lines.push('DTSTART;TZID=Europe/Berlin:'+date.replaceAll('-','')+'T'+time.replace(':','')+'00','DURATION:PT'+Math.max(15,Math.min(1440,Number(duration)||120))+'M','SUMMARY:'+escapeICS(row.title),'DESCRIPTION:'+escapeICS(row.body),'LOCATION:'+escapeICS(d.location),'STATUS:'+(d.cancelled?'CANCELLED':'CONFIRMED'));
   if(rule){const frequency=d.repeat==='monthly'?'FREQ=MONTHLY;BYMONTHDAY='+Number(d.date.slice(-2)):'FREQ=WEEKLY;INTERVAL='+(d.repeat==='fortnightly'?2:1);lines.push('RRULE:'+frequency+';UNTIL='+d.repeatUntil.replaceAll('-','')+'T235959Z');if(d.exceptions?.length)lines.push('EXDATE;TZID=Europe/Berlin:'+d.exceptions.map(day=>day.replaceAll('-','')+'T'+baseTime.replace(':','')+'00').join(','));}
   lines.push('END:VEVENT');
  };
  if(Array.isArray(row.attending_dates)){for(const original of row.attending_dates){if(d.exceptions?.includes(original))continue;const c=d.occurrenceChanges?.[original]||{};emit(original,c.date||original,c.time||baseTime,c.duration||d.duration,{attending:true});}}
  else{const c=!recurring?d.occurrenceChanges?.[d.date]||{}:{};emit(d.date,c.date||d.date,c.time||baseTime,c.duration||d.duration,{rule:!!recurring});if(recurring)for(const [original,c]of Object.entries(d.occurrenceChanges||{})){if(d.exceptions?.includes(original))continue;emit(original,c.date,c.time,c.duration,{override:true});}}
 }
 lines.push('END:VCALENDAR');return lines.map(foldICS).join('\r\n')+'\r\n';
}
