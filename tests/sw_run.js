const http=require("http"),fs=require("fs"),path=require("path");const {chromium}=require("playwright");
const ROOT=path.join(__dirname,".."),NM=path.join(__dirname,"node_modules"),OUT=path.join(__dirname,"pf");
const tick=fs.readFileSync(ROOT+"/tickers.js","utf8");const NAMES={};let m,re=/\[\s*"([^"]+)"\s*,\s*"([^"]*)"/g;while((m=re.exec(tick)))NAMES[m[1]]=m[2];
function series(sym,n){const t=[],c=[],v=[];let seed=[...sym].reduce((a,ch)=>a+ch.charCodeAt(0)*7,3);const rnd=()=>((seed=(seed*9301+49297)%233280)/233280);
 let p=sym.includes(".K")?50000*(0.5+rnd()):sym==="^VIX"?17:sym==="KRW=X"?1380:100*(0.5+rnd());const drift=(rnd()-0.45)*0.006,noise=0.01+rnd()*0.03;
 const day0=Math.floor(Date.now()/1000)-n*86400;for(let i=0;i<n;i++){let r=drift+(rnd()-0.5)*noise;if(i===n-1)r=(rnd()-0.5)*0.12;p*=1+r;t.push(day0+i*86400);c.push(+p.toFixed(2));v.push(Math.round(1e6*(0.5+rnd()*(i>=n-5?3:1))));}
 return {t,c,v,o:c,h:c,l:c,a:c,div:[],meta:{shortName:NAMES[sym]||sym,currency:sym.includes(".K")||sym==="^KS11"?"KRW":"USD",fiftyTwoWeekHigh:Math.max(...c)*(1+rnd()*0.4)}};}
const hits=[];const recent={generated:new Date().toISOString(),days:90,symbols:{}};Object.keys(NAMES).forEach(s=>recent.symbols[s]=series(s,300));
const server=http.createServer((req,res)=>{const u=new URL(req.url,"http://x");const J=o=>{res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify(o));};
 if(u.pathname==="/api/config")return J({snapshotBase:null,reason:"BLOB_SUSPENDED",sync:true,syncStore:"redis",news:true});
 if(u.pathname==="/api/snap"&&u.searchParams.get("recent")==="1")return J(recent);
 if(u.pathname==="/api/channel")return J({ok:true,text:"📈 미국 증시 데일리 브리핑 — 9.30(수) 마감\n\n■ 지수\nS&P500 +0.2% · 나스닥 +0.2%\nVIX 18.4 (평온)\n\n■ 종목 (오른 종목 53%)\n▲ 테슬라 +2.0%, 캐터필러 +1.8%\n▼ 컴캐스트 -2.0%\n\n※ 종가 기준 자동 집계.",generated:"2026-10-01T00:00:00Z",telegram:false});
 if(u.pathname==="/api/snap"&&u.searchParams.get("manifest")==="1"){const m={generated:new Date().toISOString(),recentDays:90,complete:true,symbols:{}};Object.keys(NAMES).forEach(k=>m.symbols[k]={history:"2026-09-28",updated:"2026-09-29"});return J(m);}
 if(u.pathname==="/api/snap"&&u.searchParams.get("symbol")){const sym=u.searchParams.get("symbol");const d=series(sym,2500);return J({s:sym,meta:d.meta,t:d.t,o:d.c,h:d.c,l:d.c,c:d.c,a:d.c,v:d.v,div:[],updated:"2026-09-28"});}
 if(u.pathname==="/api/snap"&&u.searchParams.get("popular")==="1")return J({ok:true,items:[{s:"NVDA",score:42},{s:"005930.KS",score:30},{s:"TSLA",score:22},{s:"BTC-USD",score:15},{s:"000660.KS",score:12},{s:"PLTR",score:9},{s:"SPY",score:7},{s:"XRP-USD",score:5}]});
 if(u.pathname==="/api/owner")return J({ok:true});
 if(u.pathname==="/api/hit"){hits.push(u.search);return J({ok:true});}
 if(u.pathname==="/api/chart"){const s=u.searchParams.get("symbol");const d=series(s,2500);return J({chart:{result:[{meta:d.meta,timestamp:d.t,indicators:{quote:[{close:d.c,open:d.c,high:d.c,low:d.c,volume:d.v}],adjclose:[{adjclose:d.c}]}}]}});}
 if(u.pathname==="/api/fund"){const sym=u.searchParams.get("symbol");let seed=[...sym].reduce((a,c)=>a+c.charCodeAt(0),7);const r=()=>((seed=(seed*9301+49297)%233280)/233280);const kr=/\.K[SQ]$/.test(sym);return J({symbol:sym,ok:true,market:kr?"KR":"WORLD",info:{per:{value:(5+r()*40).toFixed(2)},pbr:{value:(0.5+r()*5).toFixed(2)},roe:{value:(-5+r()*30).toFixed(2)},dividendYieldRatio:{value:(r()*5).toFixed(2)},foreignRate:{value:(r()*60).toFixed(2)},lastClosePrice:{value:"100"}},consensus:kr?{priceTargetMean:String(Math.round(100*(0.8+r()*0.6))),analystCount:5}:null,trend:kr?[1,2,3,4,5].map(i=>({bizdate:"2026100"+i,closePrice:"100",foreignerPureBuyQuant:String(Math.round((r()-0.4)*10000)),organPureBuyQuant:String(Math.round((r()-0.5)*8000)),individualPureBuyQuant:"0"})):null});}
 if(u.pathname==="/api/news"){if(process.env.NONEWS)return J({ok:true,items:[]});const q=u.searchParams.get("q");const items=u.searchParams.get("type")==="stock"?[{title:q+", 3분기 실적 기대감에 급등…증권가 목표가 상향",press:"한국경제",time:"2026-09-29",url:"#"},{title:q+" 주가 급변동, 외국인 순매수 전환",press:"연합뉴스",time:"2026-09-29",url:"#"}]:
  [{title:"연준, 기준금리 동결…연내 인하 기대는 유지",press:"연합뉴스",time:"2026-09-29",url:"#",desc:"미국 연방준비제도가 기준금리를 동결했다. 파월 의장은 물가가 목표에 근접하고 있다며 연내 인하 가능성을 열어 뒀다. 시장은 12월 인하 확률을 높게 보고 있다."},{title:"원달러 환율 1,380원대 마감, 달러 약세",press:"한국경제",time:"2026-09-29",url:"#"},{title:"반도체 HBM 수요 급증에 SK하이닉스·삼성전자 강세",press:"매일경제",time:"2026-09-29",url:"#",desc:"AI 서버 투자 확대로 고대역폭메모리(HBM) 수요가 급증하면서 반도체 대형주가 동반 강세를 보였다. 증권가는 4분기에도 공급 부족이 이어질 것으로 전망했다."},{title:"코스피, 외국인 매수에 상승 마감…관세 협상 기대",press:"뉴시스",time:"2026-09-29",url:"#"},{title:"한은 기준금리 인하 가능성 시사",press:"이데일리",time:"2026-09-29",url:"#"},{title:"이란-이스라엘 긴장 고조에 유가 급등",press:"서울경제",time:"2026-09-29",url:"#"}];return J({ok:true,items});}
 if(u.pathname.startsWith("/api/"))return J({ok:false});
 let f=path.join(ROOT,u.pathname==="/"?"index.html":u.pathname);if(!fs.existsSync(f)){res.writeHead(404);return res.end();}
 res.writeHead(200,{"Content-Type":f.endsWith(".js")?"text/javascript":"text/html; charset=utf-8"});fs.createReadStream(f).pipe(res);});
// 오염 데이터 주입: 오래된 종목(10일 전 마감), 하루 +55% 급등 오류
{const s=recent.symbols["AMD"];s.t=s.t.map(x=>x-10*86400);}
{const s=recent.symbols["INTC"];const n=s.c.length;s.c[n-1]=+(s.c[n-2]*1.55).toFixed(2);}
(async()=>{await new Promise(r=>server.listen(8797,r));const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:1280,height:900},locale:"ko-KR"});const p=await ctx.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));
 await p.route("**/cdn.jsdelivr.net/**",route=>{const url=route.request().url();const map={"chart.umd.min.js":"chart.js/dist/chart.umd.js","hammer.min.js":"hammerjs/hammer.min.js","chartjs-plugin-zoom.min.js":"chartjs-plugin-zoom/dist/chartjs-plugin-zoom.min.js","html2canvas.min.js":"html2canvas/dist/html2canvas.min.js"};const k=Object.keys(map).find(k=>url.endsWith(k));if(k)return route.fulfill({path:path.join(NM,map[k]),contentType:"text/javascript"});return route.fulfill({body:"",contentType:"text/css"});});
 await p.route("**/clarity.ms/**",r=>r.fulfill({body:""}));
 await p.addInitScript(()=>{try{localStorage.setItem("sm.storageWarnDismissed","1");localStorage.setItem("sm.cloudOfferDismissed","1");localStorage.setItem("sm.owner","TOK");}catch(e){}});
 await p.goto("http://localhost:8797/",{waitUntil:"networkidle"});
 await p.close();
const OVL=()=>{const root=document.body;const W=document.documentElement.clientWidth;const boxes=[];
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=walker.nextNode())){if(!n.textContent.trim())continue;const el=n.parentElement;const cs=getComputedStyle(el);if(cs.visibility==="hidden"||cs.display==="none"||el.closest("[hidden]")||el.closest("details:not([open])>:not(summary)"))continue;const r=document.createRange();r.selectNodeContents(n);let cl={left:-1e9,top:-1e9,right:1e9,bottom:1e9};for(let a=el;a&&a!==document.body;a=a.parentElement){const s=getComputedStyle(a);if(s.overflow!=="visible"||s.overflowX!=="visible"||s.overflowY!=="visible"){const q=a.getBoundingClientRect();cl={left:Math.max(cl.left,q.left),top:Math.max(cl.top,q.top),right:Math.min(cl.right,q.right),bottom:Math.min(cl.bottom,q.bottom)};}}
 [...r.getClientRects()].forEach(b0=>{const b={left:Math.max(b0.left,cl.left),top:Math.max(b0.top,cl.top),right:Math.min(b0.right,cl.right),bottom:Math.min(b0.bottom,cl.bottom)};if(b.right-b.left>1&&b.bottom-b.top>1)boxes.push({el,b,t:n.textContent.trim().slice(0,24)});});}
 const bad=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],c=boxes[j];if(a.el===c.el||a.el.contains(c.el)||c.el.contains(a.el))continue;const fx=e=>{for(let x=e;x&&x!==document.body;x=x.parentElement){if(getComputedStyle(x).position==="fixed")return x;}return null;};if(fx(a.el)!==fx(c.el))continue;const ox=Math.min(a.b.right,c.b.right)-Math.max(a.b.left,c.b.left),oy=Math.min(a.b.bottom,c.b.bottom)-Math.max(a.b.top,c.b.top);if(ox>2&&oy>3)bad.push(a.t+" ⟷ "+c.t+" ["+(a.el.className||a.el.tagName)+"/"+(c.el.className||c.el.tagName)+"]");}
 const clip=[];root.querySelectorAll("*").forEach(e=>{if(e.closest("[hidden]"))return;const cs=getComputedStyle(e);if(e.children.length===0&&e.textContent.trim()&&e.scrollWidth>e.clientWidth+2&&cs.overflow!=="visible"&&cs.textOverflow!=="ellipsis"&&e.clientWidth>0)clip.push((e.className||e.tagName)+":"+e.textContent.trim().slice(0,20));
   const r=e.getBoundingClientRect();if(r.width&&r.right>W+1){let sc=null;for(let a=e.parentElement;a;a=a.parentElement){const s=getComputedStyle(a);if(/(auto|scroll)/.test(s.overflowX)&&a.scrollWidth>a.clientWidth){sc=a;break;}if(s.overflowX==="hidden"){sc="HIDDEN "+(a.className||a.tagName);break;}}if(!sc||typeof sc==="string")clip.push("OUT "+(e.className||e.tagName)+":"+Math.round(r.right)+(sc?" ("+sc+")":" (스크롤 없음)"));}});
 return {bad:[...new Set(bad)].slice(0,25),clip:[...new Set(clip)].slice(0,15)};};
async function check(p,label){const r=await p.evaluate(OVL);const ov=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 if(r.bad.length||r.clip.length||ov>0){console.log("\n### "+label,"겹침",r.bad.length,"잘림",r.clip.length,"가로넘침",ov);r.bad.forEach(x=>console.log("  ×",x));r.clip.forEach(x=>console.log("  ✂",x));await p.screenshot({path:path.join(OUT,"sw-"+label.replace(/\W/g,"_")+".png"),fullPage:true});} else console.log("ok "+label);}
const V=[
 ["home",p=>p.evaluate(()=>switchTab("home"))],["brief",p=>p.evaluate(()=>switchTab("brief"))],["single",p=>p.evaluate(()=>switchTab("single"))],["compare",p=>p.evaluate(()=>switchTab("compare"))],
 ["sim-hold",p=>p.evaluate(()=>{switchTab("sim");switchPortfolioMode("hold")})],["sim-sim",p=>p.evaluate(()=>switchPortfolioMode("sim"))],["sim-rebal",p=>p.evaluate(()=>switchPortfolioMode("rebal"))],
 ["guide",p=>p.evaluate(()=>switchTab("guide"))],
 ...["list","map","news","div","disc","guru","ipo","macro"].map(w=>["watch-"+w,p=>p.evaluate((w)=>{switchTab("watch");switchWatchPane(w)},w)]),
 ["channel",p=>p.evaluate(()=>switchTab("channel"))],["mind",p=>p.evaluate(()=>switchTab("mind"))],
 ["card-work",p=>p.evaluate(()=>{switchTab("onecard");MK.tab="work";makerRender()})],
 ["card-result",async p=>{await p.click('.wbRight [data-hub="one"]');await p.waitForFunction(()=>{const r=document.getElementById("mkResult");return r&&!r.hidden&&r.querySelector("figure img");},{timeout:90000}).catch(()=>{});}],
 ["card-one-app",p=>p.evaluate(()=>{MK.tab="one";MK.mode="app";makerRender()})],["card-one-text",p=>p.evaluate(()=>{MK.mode="text";makerRender()})],["card-lib",p=>p.evaluate(()=>{MK.tab="lib";makerRender()})],
 ["report-today",p=>p.evaluate(()=>{switchTab("report");RP.tab="today";renderReport()})],["report-new",p=>p.evaluate(()=>{RP.tab="new";renderReport()})],["report-saved",p=>p.evaluate(()=>{RP.tab="saved";renderReport()})],
 ["analyst-biz",async p=>{await p.evaluate(()=>{switchTab("analyst");AN.mod="biz";AN.sym="005930.KS";anRun();});await p.waitForFunction(()=>!AN.busy,{timeout:120000}).catch(()=>{});}],["analyst-pf",async p=>{await p.evaluate(()=>{AN.mod="pf";anRun();});await p.waitForFunction(()=>!AN.busy,{timeout:120000}).catch(()=>{});}],
 ["report-stock",async p=>{await p.evaluate(()=>{RP.tab="new";renderReport();rpGo({id:"stock:005930.KS",kind:"stock",sym:"005930.KS"},null)});await p.waitForSelector(".rpStance",{timeout:60000}).catch(()=>{});}],
];
for(const [w,h] of [[390,844],[768,1000],[1280,900]]){
 const p2=await ctx.newPage();p2.on("pageerror",e=>errs.push(w+" "+(globalThis.CUR||"")+" "+e.message+" @"+(e.stack||"").split("\n")[1]));await p2.setViewportSize({width:w,height:h});await p2.goto("http://localhost:8797/",{waitUntil:"networkidle"});await p2.evaluate(()=>switchTab("brief"));await p2.waitForTimeout(2500);
 for(const [nm,fn] of V){globalThis.CUR=nm;try{await fn(p2);}catch(e){console.log("skip",nm,e.message.slice(0,80));continue;}await p2.waitForTimeout(nm.startsWith("watch-")||nm==="card-work"?2500:1200);await check(p2,w+"-"+nm);}
 await p2.close();}
console.log("\n오류",errs.length,errs.slice(0,8));await b.close();server.close();})();
