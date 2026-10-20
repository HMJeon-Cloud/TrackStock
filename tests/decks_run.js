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
 if(u.pathname==="/api/snap"&&u.searchParams.get("universe")){const m=u.searchParams.get("universe");const secs=["Information Technology","Health Care","Financials","Consumer Discretionary","Communication Services","Industrials","Consumer Staples","Energy","Utilities","Real Estate","Materials"];const N=m==="us"?503:200;const rows=[];let seed=7;const rnd=()=>((seed=(seed*9301+49297)%233280)/233280);for(let i=0;i<N;i++){const r1=(rnd()-0.52)*0.06;const c=m==="us"?50+rnd()*400:10000+rnd()*300000;const vh=-rnd()*0.3;rows.push({s:m==="us"?(i<5?["AAPL","MSFT","NVDA","AMZN","BRK-B"][i]:"S"+i):String(100000+i)+".KS",n:m==="us"?"Company "+i:"종목"+i,sec:m==="us"?secs[i%11]:"",c:+c.toFixed(2),r1:+r1.toFixed(4),r5:0.01,m1:0.02,a20:rnd()>0.31,a50:rnd()>0.54,a200:rnd()>0.45,hi:c*(1-vh)*1.001,lo:c*0.7,vh:vh,vl:0.3,nh:i%22===0,nl:i%250===0,amt:Math.round(c*1e6*(0.2+rnd()*3)),ax:+(0.5+rnd()*2).toFixed(2),t:Date.now()-86400e3,nd:280,stale:i%97===0});}
   return J({ver:1,mkt:m,generated:new Date().toISOString(),asOf:Date.now()-86400e3,n:N,fresh:N-5,kept:5,listSource:m==="us"?"wikipedia":"naver",rows});}
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
(async()=>{await new Promise(r=>server.listen(8803,r));const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:1280,height:900},locale:"ko-KR"});const p=await ctx.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));
 await p.route("**/cdn.jsdelivr.net/**",route=>{const url=route.request().url();const map={"chart.umd.min.js":"chart.js/dist/chart.umd.js","hammer.min.js":"hammerjs/hammer.min.js","chartjs-plugin-zoom.min.js":"chartjs-plugin-zoom/dist/chartjs-plugin-zoom.min.js","html2canvas.min.js":"html2canvas/dist/html2canvas.min.js"};const k=Object.keys(map).find(k=>url.endsWith(k));if(k)return route.fulfill({path:path.join(NM,map[k]),contentType:"text/javascript"});return route.fulfill({body:"",contentType:"text/css"});});
 await p.route("**/clarity.ms/**",r=>r.fulfill({body:""}));
 await p.addInitScript(()=>{try{localStorage.setItem("sm.storageWarnDismissed","1");localStorage.setItem("sm.cloudOfferDismissed","1");localStorage.setItem("sm.owner","TOK");}catch(e){}});
 await p.goto("http://localhost:8803/",{waitUntil:"networkidle"});
 await p.evaluate(()=>switchTab("brief"));await p.waitForTimeout(3000);
 await p.evaluate(()=>switchTab("onecard"));await p.waitForSelector("#mkBody .wbList",{timeout:60000});await p.waitForTimeout(2500);
 await p.screenshot({path:path.join(OUT,"wb-1.png")});
 console.log("kpis",await p.evaluate(()=>[...document.querySelectorAll(".wbKpi")].map(k=>k.innerText.replace(/\s+/g," "))));
 console.log("list",await p.evaluate(()=>[...document.querySelectorAll(".wbItem")].slice(0,10).map(k=>k.querySelector("b").textContent)));
 await p.waitForFunction(()=>document.querySelector(".wbBriefBox .wbBrH"),{timeout:60000}).catch(()=>{});
 console.log("brief0",await p.evaluate(()=>(document.querySelector(".wbBriefBox")||{}).innerText));
 await p.evaluate(()=>{switchTab("brief");switchBriefMarket("us");});await p.waitForFunction(()=>briefState.result&&briefState.result.uniTemp,{timeout:60000}).catch(()=>{});await p.waitForTimeout(1200);
 console.log("brief KPI:",await p.evaluate(()=>[...document.querySelectorAll("#briefKpi .kpi")].map(k=>k.innerText.replace(/\s+/g," ")).join(" | ")));
 console.log("temp:",await p.evaluate(()=>document.querySelector(".briefTempDesc").innerText));
 console.log("health:",await p.evaluate(()=>document.querySelector("#briefHealth .fdHow").innerText.slice(0,120)));
 await p.screenshot({path:path.join(OUT,"brief-us.png"),fullPage:true});
 await p.evaluate(()=>switchTab("onecard"));await p.waitForSelector("#mkBody .wbList",{timeout:60000});await p.waitForTimeout(1500);
 const tests=[["hub:dd","multi"],["hub:vix","multi"],["hub:ma200","multi"],["hub:dd","one"],["hub:vix","one"],["hub:worst","multi"],["hub:season","multi"],["hub:years","multi"],["hub:decade","multi"],["hub:fx","multi"],["hub:dow","multi"],["hub:sale","multi"],["hub:sector","multi"],["hub:vol","multi"]]; for(const [ctx,mode] of tests){
   await p.evaluate(()=>{const c=document.querySelector('#mkResult .wbClose');if(c)c.click();});await p.waitForTimeout(200);
   await p.evaluate((ctx)=>{const el=document.querySelector('.wbItem[data-wsel="'+ctx+'"]');if(el)el.click();else{MK.sel=ctx;makerRender();}},ctx);
   await p.waitForFunction(()=>document.querySelector(".wbBriefBox .wbBrH")||document.querySelector(".wbBriefBox .briefDim")&&!/준비하는/.test(document.querySelector(".wbBriefBox").innerText),{timeout:90000}).catch(()=>{});
   const bt=await p.evaluate(()=>(document.querySelector(".wbBriefBox")||{}).innerText);
   await p.click('.wbRight [data-hub="'+mode+'"]');
   const ok=await p.waitForFunction(()=>{const r=document.getElementById("mkResult");return r&&!r.hidden&&r.querySelectorAll("figure img").length;},{timeout:120000}).then(()=>true).catch(()=>false);
   const n=await p.evaluate(()=>document.querySelectorAll("#mkResult figure img").length);
   const names=await p.evaluate(()=>[...document.querySelectorAll("#mkResult figcaption span")].map(x=>x.textContent).slice(0,5));
   console.log("\n##",ctx,mode,"ok",ok,"cards",n,names.join(" | "));console.log("brief:",String(bt).slice(0,500).replace(/\n+/g," / "));
   const imgs=await p.evaluate(()=>[...document.querySelectorAll("#mkResult figure img")].map(i=>i.src));
   imgs.forEach((u,i)=>{if(u.startsWith("data:"))fs.writeFileSync(path.join(OUT,"wb-"+ctx.replace(/\W/g,"_")+"-"+mode+"-"+i+".png"),Buffer.from(u.split(",")[1],"base64"));});
   if(ctx==="hub:hi52"&&mode==="multi"){await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:path.join(OUT,"wb-2.png")});await p.evaluate(()=>document.getElementById("mkResult").scrollIntoView());await p.screenshot({path:path.join(OUT,"wb-3.png")});}
 }
 console.log("SCORES",await p.evaluate(()=>mkTopicsScored().filter(x=>/hub:(dd|vix|ma200)/.test(x.ctx)).map(x=>x.ctx+" "+x.s+" "+x.why).join(" || ")));
 console.log("done",await p.evaluate(()=>[...document.querySelectorAll(".wbDone")].map(x=>x.parentNode.textContent.slice(0,30))));
 const m=await ctx.newPage();await m.setViewportSize({width:390,height:844});await m.goto("http://localhost:8803/",{waitUntil:"networkidle"});await m.evaluate(()=>switchTab("brief"));await m.waitForTimeout(2500);await m.evaluate(()=>switchTab("onecard"));await m.waitForSelector("#mkBody .wbList",{timeout:60000});await m.waitForTimeout(1500);
 console.log("mobile ovf",JSON.stringify(await m.evaluate(()=>{const W=document.documentElement.clientWidth;const bad=[];document.querySelectorAll("#tab-onecard *").forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.right>W+1)bad.push((e.className||e.tagName)+":"+Math.round(r.right));});return {sw:document.documentElement.scrollWidth,W,bad:bad.slice(0,6)};})));await m.screenshot({path:path.join(OUT,"wb-m.png"),fullPage:true});
 console.log("\n오류",errs.length,errs.slice(0,5));await b.close();server.close();})();
