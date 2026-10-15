import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
export async function verifyDiscordUpdates({setup,member,wait}){
 const page=await setup(member,'member',null,true,true,true),{context:c,hubContext:ctx,document:d}=page,api=c.RabenUpdates;
 const sources=[api.roadmapDiscord(),api.patchnotesDiscord(),api.guideDiscord()];
 for(const parts of sources){assert.ok(parts.length);for(const [index,p] of parts.entries()){assert.ok(p.length<=1900,'Discord message fits normal account');assert.ok(p.includes('\n\n'));assert.equal(p.includes('\\n'),false,'real newlines');assert.ok(!p.includes('@everyone'));if(parts.length>1)assert.ok(p.includes('Teil '+(index+1)+'/'+parts.length));}}
 const roadmap=sources[0].join('\n');assert.equal(api.roadmap.length,20);for(const point of api.roadmap)assert.ok(roadmap.includes('**'+point.number+' · '+point.title+'**'));assert.ok(roadmap.includes('kein fester Veröffentlichungstermin'));
 const notes=sources[1].join('\n');for(const version of ['2026.10.15.3','2026.10.15.2'])assert.ok(notes.includes(version));for(const word of ['15 Minuten','Lautstärkeregler','10 MiB','Kalender','Zwischenablage'])assert.ok(notes.includes(word));
 assert.equal(api.patchnotesDiscord(api.releases[1],false).join('\n').includes('2026.10.15.3'),false);
 const mention=api.splitDiscord('Test',['@everyone @here <@12345>']);assert.equal(mention[0].includes('@everyone'),false);assert.ok(mention[0].includes('@\u200beveryone'));
 const unicode=api.splitDiscord('Unicode',['🐦'.repeat(5000)],200);for(const part of unicode){assert.ok(part.length<=200);assert.equal([...part].some(char=>char.length===1&&char.charCodeAt(0)>=0xd800&&char.charCodeAt(0)<=0xdfff),false,'no broken surrogate pairs');}
 await ctx.navigate('futureRoadmap');await wait();assert.equal(page.root.querySelectorAll('[data-roadmap-status=planned]').length,20);const panel=page.root.querySelector('.discord-copy-panel');assert.ok(panel);const copied=[];c.navigator.clipboard={writeText:value=>{copied.push(value);return Promise.resolve();}};const first=panel.querySelector('button');first.click();await wait();assert.equal(copied[0],api.roadmapDiscord()[0]);assert.match(panel.querySelector('[role=status]').textContent,/kopiert/);
 c.navigator.clipboard={writeText:()=>Promise.reject(new Error('clipboard denied'))};first.click();await wait();assert.ok(panel.querySelector('.discord-text-preview').open);assert.match(panel.querySelector('[role=status]').textContent,/Strg\+C/);assert.equal(panel.querySelector('textarea').readOnly,true);
 await ctx.navigate('quickGuide');await wait();assert.equal(page.root.querySelectorAll('.quick-guide-card').length,4);for(const label of ['Mit Discord anmelden','Status prüfen','Mein Profil erstellen','Charakter hinzufügen','Ganzer Clan','Infokarte hinzufügen'])assert.ok(page.root.textContent.includes(label),label);assert.equal(page.root.querySelector('a[href="https://example.com/clan.html"]').textContent,'Zum Clanbereich');
 await ctx.navigate('patchnotes');await wait();const current=page.root.querySelector('.discord-copy-panel');assert.ok(current.textContent.includes('Aktuelle Patchnotes'));assert.equal(page.root.querySelectorAll('.patchnote').length,api.releases.length);
 // The public instructions render without login, a backend client or a request.
 const {document,Event}=parseHTML('<html><body><section data-quick-guide></section></body></html>'),publicContext={document,Event,URL,location:{href:'https://example.com/anleitung.html'},navigator:{},Raben:{config:{siteUrl:'https://example.com/'}}};publicContext.window=publicContext;
 vm.runInNewContext(await readFile(new URL('../updates.js',import.meta.url),'utf8'),publicContext);assert.equal(document.querySelectorAll('.quick-guide-card').length,4);assert.equal(document.querySelector('iframe,img,script'),null);
 c.dispatchEvent(new page.Event('raben-lock'));
 console.log('PASS Discord/member guide: full current patchnotes, exactly 20 planned points, bounded Markdown parts, Unicode/mention protection, copy and manual fallback, member navigation, actual profile labels and public instructions without login.');
}
