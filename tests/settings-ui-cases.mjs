import assert from 'node:assert/strict';
export async function verifySettingsUI({setup,wait,member,lead,id}) {
  const input=(host,label)=>{const wrap=[...host.querySelectorAll('label')].find(n=>n.firstChild?.textContent===label);assert.ok(wrap,'field '+label);return wrap.querySelector('input,textarea,select');};
  const p=await setup(member,'member',null,true);
  assert.ok(p.root.querySelector('[data-kind="clanInfo"]'));
  assert.equal(p.root.querySelector('[data-kind="webhook"]'),null);
  p.hubContext.navigate('settings');await wait();let f=p.root.querySelector('.settings-form');
  assert.equal(f.querySelectorAll('button[type="submit"]').length,2,'Save available above and below settings');
  input(f,'Schriftart').value='verdana';input(f,'Schriftfarbe').value='#c4efff';input(f,'Schriftgröße in Pixeln').value='20';input(f,'Abstimmungen').checked=true;
  input(f,'Schriftfarbe').dispatchEvent(new p.Event('input'));
  assert.equal(f.querySelector('.settings-preview').style.color,'#c4efff');
  f.dispatchEvent(new p.Event('submit',{cancelable:true}));await wait();
  assert.equal(p.data.raben_preferences[0].font_size,20);assert.ok(p.data.raben_preferences[0].subscriptions.includes('poll'));
  assert.equal(p.document.documentElement.style.fontSize,'20px');assert.match(p.document.documentElement.style.getPropertyValue('--sans'),/Verdana/);
  assert.ok(p.root.textContent.includes('Deine Einstellungen sind gespeichert.'));
  assert.ok(!p.calls.some(c=>c.table==='raben_preferences'&&c.operation==='upsert'),'No forbidden account-column upsert');
  // Reopen and save an existing record, the precise regression missed by the old mock.
  p.hubContext.navigate('settings');await wait();f=p.root.querySelector('.settings-form');assert.equal(input(f,'Schriftart').value,'verdana');input(f,'Schriftgröße in Pixeln').value='18';f.dispatchEvent(new p.Event('submit',{cancelable:true}));await wait();assert.equal(p.data.raben_preferences.length,1);assert.equal(p.data.raben_preferences[0].font_size,18);
  p.hubContext.navigate('clanInfo');await wait();assert.ok(!p.root.querySelector('.settings-form'),'Members read but do not edit clan information');
  const owner=await setup(lead,'member',null,true);
  for(const kind of ['access','publicSettings','webhook'])assert.ok(owner.root.querySelector('[data-kind="'+kind+'"]'),'Admin in normal clan area sees '+kind);
  owner.hubContext.navigate('clanInfo');await wait();f=owner.root.querySelector('.settings-form');input(f,'Über unseren Clan').value='Unser gemeinsames Clanwissen';f.dispatchEvent(new owner.Event('submit',{cancelable:true}));await wait();assert.equal(owner.data.raben_clan_information[0].body,'Unser gemeinsames Clanwissen');assert.ok(owner.root.textContent.includes('Claninfos gespeichert.'));
  owner.data.raben_ranks=[{id:id(970),label:'Jarl',category:'rank',description:'Clan-Owner',sort_order:0},{id:id(971),label:'Huskarl',category:'rank',description:'',sort_order:20},{id:id(972),label:'Godi',category:'office',description:'',sort_order:0},{id:id(973),label:'Hofschmied',category:'office',description:'',sort_order:1}];
  owner.hubContext.navigate('access');await wait();f=owner.root.querySelector('[data-member-id="'+member.user_id+'"]');input(f,'Clanrang').value=id(971);input(f,'Godi').checked=true;input(f,'Hofschmied').checked=true;f.dispatchEvent(new owner.Event('submit',{cancelable:true}));await wait();
  assert.equal(owner.data.raben_member_offices.length,2);assert.equal(owner.data.raben_member_ranks[0].rank_id,id(971));assert.equal(owner.data.raben_memberships.find(r=>r.user_id===member.user_id).role,'member','Clan rank does not elevate website role');assert.ok(f.querySelector('.rp-rank'));assert.equal(f.querySelectorAll('.clan-office').length,2);
  owner.hubContext.navigate('webhook');await wait();f=owner.root.querySelector('.settings-form');const url=f.querySelector('input[type="password"]');url.value='https://discord.com/api/webhooks/123456789012345678/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';input(f,'Automatische Meldungen an Discord aktivieren').checked=true;f.dispatchEvent(new owner.Event('submit',{cancelable:true}));await wait();assert.equal(url.value,'','Webhook token cleared after successful save');assert.ok(owner.calls.some(c=>c.rpc==='raben_save_discord_webhook'&&c.args.p_scopes.includes('event')));
  p.context.dispatchEvent(new p.Event('raben-lock'));assert.equal(p.document.body.classList.contains('personal-appearance'),false);assert.equal(p.document.documentElement.style.fontSize,'','No appearance leaks into next account');
  console.log('PASS: repeated personal saves, preview and persisted typography, member/admin navigation, clan info editing, multiple offices without privilege escalation, secret webhook entry and logout reset.');
}
