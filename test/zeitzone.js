// node test/zeitzone.js
// Dieselben Funktionen aus index.html, einmal mit TZ=America/New_York und
// einmal mit TZ=Europe/Berlin. Die Zuordnung muss identisch sein, auch am
// 25.10.2026 (Umstellung in Berlin).
const {spawnSync}=require('child_process');
const fs=require('fs');
const path=require('path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const src=html.split(/<script[^>]*>/).pop().replace(/<\/script>[\s\S]*$/,'');
const stub=`
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
globalThis.location={origin:'https://example.test',pathname:'/index.html'};
globalThis.document={getElementById:()=>null,querySelectorAll:()=>[],addEventListener:()=>{}};
globalThis.window=globalThis;
globalThis.msal={PublicClientApplication:function(){this.initialize=()=>Promise.resolve();this.getAllAccounts=()=>[];this.getActiveAccount=()=>null;}};
`;
const probe=`
const fmt=(d,opt)=>d.toLocaleString('de-DE',opt);
const row=(id,stufe,datum,erg)=>({id,stufe,dt:mwDatum(datum),erg,name:'Person '+id,standort:'Werneck'});
const doppelt=mwOhneDoppel([
  row('p1',1,'29.03.2026 02:30','norueck'),
  row('p1',1,'29.03.2026 03:10','kein'),
  row('p2',1,'25.10.2026 01:00','kein'),
  row('p2',1,'25.10.2026 02:30','norueck'),
  row('p3',1,'24.10.2026 23:30','norueck'),
  row('p3',2,'25.10.2026 23:30','kein')
]);
const von=tzWall(2026,9,25), bis=tzWall(2026,9,25,23,59,59,999);
D.mw=doppelt; MW_STAND.Werneck=new Date('2026-10-25T10:00:00Z'); MW.stufe=0;
const ansicht=mwGespraeche(von,bis,/werneck/i);
const nFor=(label)=>{const i=ansicht.indexOf(label);if(i<0)return 0;const m=ansicht.slice(i,i+500).match(/mw-n">(\\d+)/);return m?+m[1]:0;};
const jetzt=tzWall(2026,9,25,18,0);
const woche=qmWeekBounds(43,2026);
const naechsterMonat=tzParts(new Date('2026-10-31T23:30:00Z'));
const out={
  a:mwDatum('19.10.26 11:38').toISOString(),
  b:mwDatum('22.10.2026 11:49:58').toISOString(),
  aFmt:fmt(mwDatum('19.10.26 11:38'),{hour:'2-digit',minute:'2-digit'}),
  bFmt:fmt(mwDatum('22.10.2026 11:49:58'),{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
  fold:mwDatum('25.10.2026 02:30').toISOString(),
  nachFold:mwDatum('25.10.2026 03:30').toISOString(),
  luecke:mwDatum('29.03.2026 02:30').toISOString(),
  kw25:kwOf(mwDatum('25.10.2026 12:00')),
  kw26:kwOf(mwDatum('26.10.2026 00:30')),
  kw1:kwOf(mwDatum('01.01.2026 00:30')),
  kw53:kwOf(mwDatum('31.12.2026 12:00')),
  tag25:bYMD(mwDatum('25.10.2026 02:30'))+' '+bHM(mwDatum('25.10.2026 02:30')),
  notiz:mwNotizKey('abc',1,'22.10.2026 11:49:58'),
  doppelt:doppelt.map(r=>r.id+'|'+r.stufe+'|'+r.erg+'|'+r.dt.toISOString()).sort(),
  imTag:doppelt.filter(r=>r.dt>=von&&r.dt<=bis).map(r=>r.id+'|'+r.erg+'|'+bYMD(r.dt)+'|'+bHM(r.dt)).sort(),
  gruende:{norueck:nFor('Keine Rückmeldung vom Therapeuten'),kein:nFor('Kein Interesse / trainiert bereits')},
  reisen:mwReisen([
    {id:'w1',stufe:1,dt:mwDatum('18.10.2026 16:00'),erg:'folgeg',name:'W',standort:'Werneck'},
    {id:'w2',stufe:1,dt:mwDatum('22.10.2026 12:00'),erg:'folgeg',name:'W2',standort:'Werneck'},
    {id:'n1',stufe:1,dt:mwDatum('20.10.2026 11:00'),erg:'norueck',name:'N',standort:'Werneck'},
    {id:'k1',stufe:1,dt:mwDatum('20.10.2026 11:00'),erg:'kein',name:'K',standort:'Werneck'}
  ],jetzt).map(x=>x.id+':'+x.art+':'+x.letzte.erg).sort(),
  datei:fmt(new Date('2026-10-29T16:07:00Z'),{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}),
  stand:new Date('2026-10-29T16:51:00Z').toLocaleString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}),
  mitternacht:bYMD(new Date('2026-10-24T22:30:00Z'))+' '+bHM(new Date('2026-10-24T22:30:00Z')),
  monat:bYM(naechsterMonat.y,naechsterMonat.m-1),
  tagNachMitternacht:bYMD(new Date('2026-10-31T23:30:00Z')),
  mo:bYMD(woche.mo),
  so:bYMD(woche.so)+' '+bHM(woche.so),
  prax:parseZeit('2026-10-25T11:38:00').toISOString(),
  praxZ:parseZeit('2026-10-25T11:38:00+02:00').toISOString(),
  kenn:bYMD(reTag('2026-10-25'))+' '+bWD(reTag('2026-10-25')),
  werktage:pmWerktage('2026-10-19','2026-10-25'),
  xl:bYMD(parseZeit(45955)),
  standText:mwStandText(/werneck/i).replace(/style="[^"]*"/g,'')
};
console.log(JSON.stringify(out));
`;
const os=require('os');
function run(tz){
  const file=path.join(os.tmpdir(),'zeitzone-probe-'+tz.replace(/\W/g,'')+'.js');
  fs.writeFileSync(file, stub+src+'\n'+probe);
  const r=spawnSync(process.execPath,[file],{env:{...process.env,TZ:tz},encoding:'utf8'});
  if(r.status!==0){
    console.error(tz,'exit',r.status, r.error&&r.error.message);
    console.error(r.stderr);
    process.exit(1);
  }
  return JSON.parse(r.stdout);
}
const ny=run('America/New_York');
const berlin=run('Europe/Berlin');
const ja=JSON.stringify(ny);
const jb=JSON.stringify(berlin);
if(ja!==jb){
  console.error('Ausgaben unterscheiden sich');
  const a=ny,b=berlin;
  Object.keys(a).forEach(k=>{
    if(JSON.stringify(a[k])!==JSON.stringify(b[k])) console.error(k,'\n NY',a[k],'\n BE',b[k]);
  });
  process.exit(1);
}
const expect={
  a:'2026-10-19T09:38:00.000Z',
  b:'2026-10-22T09:49:58.000Z',
  aFmt:'11:38',
  bFmt:'11:49:58',
  fold:'2026-10-25T00:30:00.000Z',
  nachFold:'2026-10-25T02:30:00.000Z',
  luecke:'2026-03-29T01:30:00.000Z',
  tag25:'2026-10-25 02:30',
  notiz:'abc|1|20261022',
  datei:'29.10., 17:07',
  mitternacht:'2026-10-25 00:30',
  monat:'2026-11',
  tagNachMitternacht:'2026-11-01',
  mo:'2026-10-19',
  prax:'2026-10-25T10:38:00.000Z',
  praxZ:'2026-10-25T09:38:00.000Z',
  kenn:'2026-10-25 0',
  werktage:5
};
let failed=0;
Object.keys(expect).forEach(k=>{
  if(JSON.stringify(berlin[k])!==JSON.stringify(expect[k])){
    console.error('erwartet',k,expect[k],'ist',berlin[k]); failed++;
  }
});
if(berlin.kw25.kw!==43||berlin.kw25.jahr!==2026){console.error('KW 25.10.',berlin.kw25);failed++;}
if(berlin.kw26.kw!==44){console.error('KW 26.10.',berlin.kw26);failed++;}
if(berlin.kw1.kw!==1||berlin.kw53.kw!==53){console.error('Jahreswechsel',berlin.kw1,berlin.kw53);failed++;}
if(berlin.gruende.norueck!==1||berlin.gruende.kein!==1){console.error('Gründe',berlin.gruende);failed++;}
const keep=berlin.doppelt.find(s=>s.startsWith('p1|'));
if(!keep||keep.indexOf('norueck')<0){console.error('Dedup 29.03.',berlin.doppelt);failed++;}
if(!/17:51/.test(berlin.stand)){console.error('Stand',berlin.stand);failed++;}
if(!/25\.10/.test(berlin.standText)){console.error('Standtext',berlin.standText);failed++;}
const uhr=new Date('2026-10-25T10:00:00Z').toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'});
if(berlin.standText.indexOf(uhr)<0){console.error('Standuhr',uhr,berlin.standText);failed++;}
const xlUtc=new Date(Math.round((45955-25569)*86400000)).toISOString().slice(0,10);
if(berlin.xl!==xlUtc){console.error('Excel-Tag',berlin.xl,xlUtc);failed++;}
if(failed) process.exit(1);
console.log('ok', Object.keys(berlin).length, 'Felder identisch in America/New_York und Europe/Berlin');
