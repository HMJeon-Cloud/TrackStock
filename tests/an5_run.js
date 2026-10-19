const http=require("http"),fs=require("fs"),path=require("path");const {chromium}=require("playwright");
const ROOT=path.join(__dirname,".."),NM=path.join(__dirname,"node_modules"),OUT=path.join(__dirname,"pf");
const tick=fs.readFileSync(ROOT+"/tickers.js","utf8");const NAMES={};let m,re=/\[\s*"([^"]+)"\s*,\s*"([^"]*)"/g;while((m=re.exec(tick)))NAMES[m[1]]=m[2];
function mkDiv(sym,t,c){ if(/-USD$|^\^|=X$|=F$/.test(sym))return []; let h=[...sym].reduce((a,ch)=>a*31+ch.charCodeAt(0)>>>0,7); if(h%10<4 && !/SCHD|JEPI|005930|KO$|O$|TLT/.test(sym))return [];
 const freq=sym==="JEPI"||sym==="O"?12:/\.(KS|KQ)$/.test(sym)?(h%3===0?4:1):(h%5===0?12:4); let y=sym==="JEPI"?0.075:sym==="SCHD"?0.037:0.01+(h%50)/1000; if(sym==="KO")y=0.105; if(sym==="TLT")y=0.32;
 const out=[], step=Math.round(365/freq), n=t.length; for(let i=n-1-((h%7)*3);i>=0;i-=step){ const yrs=(n-1-i)/365; out.push([t[i], +(c[i]*y/freq*Math.pow(0.94,yrs)).toFixed(4)]);} return out.reverse(); }
function series(sym,n){const t=[],c=[],v=[];let seed=[...sym].reduce((a,ch)=>a+ch.charCodeAt(0)*7,3);const rnd=()=>((seed=(seed*9301+49297)%233280)/233280);
 let p=/SHIB|PEPE|BONK|FLOKI/.test(sym)?0.0000123*(0.5+rnd()):sym.includes(".K")?50000*(0.5+rnd()):sym==="^VIX"?17:sym==="KRW=X"?1380:100*(0.5+rnd());const drift=(rnd()-0.45)*0.006,noise=0.01+rnd()*0.03;
 const day0=Math.floor(Date.now()/1000)-n*86400;for(let i=0;i<n;i++){let r=drift+(rnd()-0.5)*noise;if(i===n-1)r=(rnd()-0.5)*0.12;p*=1+r;t.push(day0+i*86400);c.push(p<1?+p.toPrecision(6):+p.toFixed(2));v.push(Math.round(1e6*(0.5+rnd()*(i>=n-5?3:1))));}
 return {t,c,v,o:c,h:c,l:c,a:c,div:mkDiv(sym,t,c),meta:{shortName:NAMES[sym]||sym,currency:sym.includes(".K")||sym==="^KS11"?"KRW":"USD",fiftyTwoWeekHigh:Math.max(...c)*(1+rnd()*0.4)}};}
const hits=[];const recent={generated:new Date().toISOString(),days:90,symbols:{}};Object.keys(NAMES).forEach(s=>recent.symbols[s]=series(s,300));

const TD=new Date(Date.now()+9*3600e3);const ymd=(k)=>new Date(Date.now()+9*3600e3-k*86400e3).toISOString().slice(0,10).replace(/-/g,"");
const DISC={updated:new Date().toISOString(),last:ymd(0),items:[
 {id:"20261015000001",d:ymd(0),sym:"005930.KS",corp:"삼성전자",k:"insider",title:"임원ㆍ주요주주특정증권등소유상황보고서",who:"홍길동",pos:"부사장 · -",chg:5000,after:12000,rate:0,ok:true},
 {id:"20261015000002",d:ymd(0),sym:"000660.KS",corp:"SK하이닉스",k:"insider",who:"김철수",pos:"전무",chg:-3000,after:1000,ok:true},
 {id:"20261014000003",d:ymd(1),sym:"035420.KS",corp:"NAVER",k:"insider",who:"이영희",pos:"사내이사",chg:2000,after:5000,ok:true},
 {id:"20261014000004",d:ymd(1),sym:"005380.KS",corp:"현대차",k:"major",who:"국민연금공단",chg:-120000,after:20000000,rate:7.12,rateChg:-0.05,reason:"단순투자 지분 감소",ok:true},
 {id:"20261013000005",d:ymd(2),sym:"000660.KS",corp:"SK하이닉스",k:"buyback",who:"SK하이닉스",qty:1000000,amt:200000000000,period:"2026.10.15 ~ 2027.01.14",purpose:"주주가치 제고",ok:true},
 {id:"20261010000006",d:ymd(5),sym:"005930.KS",corp:"삼성전자",k:"trust",who:"삼성전자",amt:1000000000000,period:"2026.10.11 ~ 2027.04.10",ok:true},
 {id:"20261001000007",d:ymd(14),sym:"035720.KS",corp:"카카오",k:"cancel",title:"주요사항보고서(주식소각결정)",who:"카카오",ok:true},
 {id:"20260920000008",d:ymd(25),sym:"068270.KS",corp:"셀트리온",k:"buyback",qty:500000,amt:100000000000,ok:true},
 {id:"20261012000009",d:ymd(3),sym:"005930.KS",corp:"삼성전자",k:"insider",who:"박영수",pos:"상무",chg:1500,ok:true}]};
const G=(id,nm,org,filed,period,top,buys,sells)=>({id,nm,org,cik:"1",acc:"a"+id,filed,period,prevPeriod:"2026-03-31",total:top.reduce((s,x)=>s+x.v,0)*1.3,n:42,nNew:buys.filter(b=>b.kind==="new").length,nExit:sells.filter(b=>b.kind==="exit").length,top:top.map(x=>Object.assign({w:x.v/(top.reduce((s,y)=>s+y.v,0)*1.3)},x)),buys,sells});
const GURU={updated:new Date().toISOString(),gurus:[
 G("berkshire","워런 버핏","버크셔 해서웨이",new Date(Date.now()-3*86400e3).toISOString().slice(0,10),"2026-06-30",[{n:"APPLE INC",t:"AAPL",v:6e10,chg:-0.05},{n:"AMERICAN EXPRESS CO",t:"AXP",v:4e10,chg:0},{n:"BANK AMER CORP",t:"BAC",v:3e10,chg:-0.07},{n:"COCA COLA CO",t:"KO",v:2.8e10,chg:0},{n:"CHEVRON CORP NEW",t:"CVX",v:1.8e10,chg:0.02},{n:"CHUBB LIMITED",t:"CB",v:8e9,chg:"new"}],
  [{n:"CHUBB LIMITED",t:"CB",kind:"new",dv:8e9,w:0.05},{n:"DOMINOS PIZZA INC",t:"DPZ",kind:"add",dv:6e8,pct:0.25,w:0.01},{n:"POOL CORP",t:null,kind:"new",dv:4e8,w:0.003}],
  [{n:"APPLE INC",t:"AAPL",kind:"trim",dv:-3.2e9,pct:-0.05},{n:"CITIGROUP INC",t:"C",kind:"exit",dv:-2.5e9,pct:-1},{n:"BANK AMER CORP",t:"BAC",kind:"trim",dv:-2.3e9,pct:-0.07}]),
 G("pershing","빌 애크먼","퍼싱 스퀘어","2026-08-14","2026-06-30",[{n:"UBER TECHNOLOGIES INC",t:"UBER",v:2.5e9,chg:0.1},{n:"ALPHABET INC CAP STK CL C",t:"GOOG",v:2e9,chg:0}],[{n:"UBER TECHNOLOGIES INC",t:"UBER",kind:"add",dv:2e8,pct:0.1},{n:"AMAZON COM INC",t:"AMZN",kind:"new",dv:1.2e9}],[{n:"CHIPOTLE MEXICAN GRILL",t:"CMG",kind:"trim",dv:-4e8,pct:-0.2}]),
 G("himalaya","리루","히말라야 캐피털","2026-08-12","2026-06-30",[{n:"ALPHABET INC CAP STK CL A",t:"GOOGL",v:1.5e9,chg:0},{n:"BANK AMER CORP",t:"BAC",v:7e8,chg:0}],[{n:"AMAZON COM INC",t:"AMZN",kind:"add",dv:1e8,pct:0.3}],[{n:"APPLE INC",t:"AAPL",kind:"trim",dv:-5e7,pct:-0.1}])]};

const IPOD=(()=>{const it=[];let seed=7;const rnd=()=>((seed=(seed*9301+49297)%233280)/233280);const nm=["에이테크","비바이오","씨에너지","디로보틱스","이소재","에프반도체","지모빌리티","에이치헬스","아이푸드","제이게임즈","케이클라우드","엘배터리","엠디바이스","엔소프트","오메디칼"];
 for(let i=0;i<46;i++){const d=ymd(40+i*14),dem=Math.round(Math.exp(4+rnd()*3.6)),r0=-0.2+rnd()*1.6+(dem>1000?0.4:0),m1=r0*0.5-0.15+rnd()*0.5;
  it.push({cc:"c"+i,name:nm[i%15]+(i>14?(i>29?"3":"2"):""),filed:ymd(80+i*14),sbd:[d,ymd(39+i*14)],price:10000+Math.round(rnd()*30)*1000,demand:dem,lockup:+(rnd()*40).toFixed(1),sub:Math.round(dem*0.8),lead:["한국투자증권","미래에셋증권","NH투자증권"][i%3],stage:"done",code:"1"+String(i).padStart(5,"0"),sym:"1"+String(i).padStart(5,"0")+".KQ",ret:{listDate:ymd(33+i*14),o0:r0+0.1,c0:r0,d5:r0,m1:i<1?null:m1,m3:null,last:m1-0.1,days:i<1?6:70}});}
 it.push({cc:"n1",name:"큐로보",filed:ymd(30),sbd:[ymd(-3),ymd(-4)],band:[14000,16000],shares:2000000,pymd:ymd(-6),lead:"KB증권",uw:[{n:"KB증권",lead:true,q:1400000},{n:"키움증권",lead:false,q:600000}],stage:"info"});
 it.push({cc:"n2",name:"알파센서",filed:ymd(35),sbd:[ymd(0),ymd(-1)],price:21000,shares:1500000,genPct:30,minQ:20,depPct:50,lead:"삼성증권",uw:[{n:"삼성증권",lead:true,q:1000000},{n:"한국투자증권",lead:true,q:400000},{n:"대신증권",lead:false,q:100000}],listPlan:ymd(-8),pymd:ymd(-3),stage:"info"});
 it.push({cc:"n3",name:"베타팜",filed:ymd(40),sbd:[ymd(5),ymd(4)],price:9000,demand:310.5,sub:420.1,lead:"신한투자증권",stage:"info"});
 return {updated:new Date().toISOString(),items:it};})();

const MACD=(()=>{const T=(y,m,d)=>Date.UTC(y,m-1,d||1);const ymdS=t=>new Date(t).toISOString().slice(0,10).replace(/-/g,"");
 function interp(pts,from,to,noise,daily){let seed=11;const rnd=()=>((seed=(seed*9301+49297)%233280)/233280);const out=[];for(let t=from;t<=to;t+=86400e3){const d=new Date(t);if(daily&&d.getUTCDay()%6===0)continue;let i=pts.findIndex(p=>p[0]>t);if(i<0)i=pts.length-1;if(i===0)i=1;const a=pts[i-1],b=pts[i];const w=Math.min(1,Math.max(0,(t-a[0])/(b[0]-a[0])));out.push([ymdS(t),+((a[1]+(b[1]-a[1])*w)*(1+(rnd()-0.5)*noise)).toFixed(2)]);}return out;}
 const now=Date.now();
 const krw=interp([[T(1995,1),780],[T(1997,11),1000],[T(1997,12,23),1960],[T(1998,6),1350],[T(1999,6),1190],[T(2001,4),1360],[T(2004,6),1150],[T(2007,10),900],[T(2008,10,8),1420],[T(2009,3),1570],[T(2010,6),1150],[T(2016,2),1240],[T(2018,4),1060],[T(2020,3,19),1285],[T(2021,5),1110],[T(2022,9,22),1410],[T(2022,10,25),1440],[T(2023,6),1290],[T(2024,4,16),1390],[T(2024,12,27),1470],[T(2025,4,9),1484],[T(2025,7),1360],[now-20*86400e3,1390],[now,1418]],T(1995,1),now,0.004,true);
 const steps=(L)=>L.map(x=>[ymdS(T(x[0],x[1],x[2]||1)),x[3]]);
 const bok=steps([[1999,5,6,4.75],[2000,2,10,5],[2000,10,5,5.25],[2001,2,8,5],[2001,9,19,4],[2002,5,7,4.25],[2003,5,13,3.75],[2004,11,11,3.25],[2005,10,11,3.5],[2006,8,10,4.5],[2007,8,9,5],[2008,8,7,5.25],[2008,10,9,5],[2009,2,12,2],[2010,7,9,2.25],[2011,6,10,3.25],[2012,7,12,3],[2014,8,14,2.25],[2016,6,9,1.25],[2017,11,30,1.5],[2018,11,30,1.75],[2019,7,18,1.5],[2020,3,16,0.75],[2020,5,28,0.5],[2021,8,26,0.75],[2022,7,13,2.25],[2023,1,13,3.5],[2024,10,11,3.25],[2024,11,28,3],[2025,2,25,2.75],[2025,5,29,2.5]]);
 const fed=steps([[1995,1,1,5.5],[1995,7,6,5.75],[1998,9,29,5.25],[1999,6,30,5],[2000,5,16,6.5],[2001,1,3,6],[2001,12,11,1.75],[2003,6,25,1],[2004,6,30,1.25],[2006,6,29,5.25],[2007,9,18,4.75],[2008,12,16,0.25],[2015,12,17,0.5],[2018,12,20,2.5],[2019,7,31,2.25],[2020,3,16,0.25],[2022,3,17,0.5],[2023,7,27,5.5],[2024,9,19,5],[2024,12,19,4.5],[2025,9,18,4.25],[2025,10,30,4],[2026,9,17,4.25]]);
 const us10y=interp([[T(1995,1),7.8],[T(1998,10),4.2],[T(2000,1),6.7],[T(2003,6),3.1],[T(2007,6),5.2],[T(2008,12),2.1],[T(2012,7),1.4],[T(2013,12),3],[T(2016,7),1.4],[T(2018,10),3.2],[T(2020,8),0.5],[T(2022,10,21),4.25],[T(2023,10,19),4.98],[T(2024,4,25),4.7],[T(2024,9),3.65],[T(2025,1,14),4.79],[T(2025,9),4.1],[now,4.05]],T(1995,1),now,0.01,true);
 const m2=[];let v=3500;for(let y=1995;y<=2026;y++)for(let m=1;m<=12;m++){const t=T(y,m);if(t>now-60*86400e3)break;const g=(y===2020&&m>=3&&m<=12)?0.02:(y===2022&&m>=8)||(y===2023)?-0.003:0.005;v*=1+g;m2.push([ymdS(t),+v.toFixed(1)]);}
 const S=(id,n,u,f,d)=>({n,u,f,src:"x",at:ymdS(now),last:d[d.length-1],d});
 return {ver:1,updated:new Date().toISOString(),series:{krw:S("krw","원/달러 환율","원","D",krw),bok:S("bok","한국 기준금리","%","S",bok),fed:S("fed","미국 기준금리(상단)","%","S",fed),us10y:S("us10y","미 국채 10년 금리","%","D",us10y),m2:S("m2","미국 M2","","M",m2)}};})();
const server=http.createServer((req,res)=>{const u=new URL(req.url,"http://x");const J=o=>{res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify(o));};
 if(u.pathname==="/api/snap"&&u.searchParams.get("ipo")==="1")return J(IPOD);
 if(u.pathname==="/api/snap"&&u.searchParams.get("macro")==="1")return J(MACD);
 if(u.pathname==="/api/snap"&&u.searchParams.get("disc")==="1")return J(DISC);
 if(u.pathname==="/api/snap"&&u.searchParams.get("guru")==="1")return J(GURU);
 if(u.pathname==="/api/config")return J({snapshotBase:null,reason:"BLOB_SUSPENDED",sync:true,syncStore:"redis",news:true});
 if(u.pathname==="/api/snap"&&u.searchParams.get("recent")==="1")return J(recent);
 if(u.pathname==="/api/channel"&&u.searchParams.get("op")==="ai"){let body="";req.on("data",c=>body+=c);req.on("end",()=>{const b=JSON.parse(body||"{}");if(b.mode==="insight")return J({ok:true,model:"mock",out:{headline:"AI 제목: "+b.title,situation:"AI가 쓴 상황 요약.",interpretation:["해석 1","해석 2"],opinion:"AI 의견 문장. "+b.stance,forecast:{"회복":"조건 A","횡보":"조건 B","추가 하락":"조건 C"},plan:["계획 1","계획 2","계획 3"],watch:["조건 1","조건 2"]}});if(b.mode!=="deck")return J({ok:false,reason:"NO_KEY"});const L=(b.lines||[]).filter(l=>/\d/.test(l.text));const num=t=>(t.match(/[+\-]?\d[\d,]*(?:\.\d+)?%?/)||[""])[0];const cards=[{kicker:"표지",title:b.title+"\n숫자로 풀어 보기",lead:"묶음 전체를 6장으로 다시 정리했어요.",sub:"",rows:[],takeaway:""}];for(let k=0;k<5;k++){const rows=L.slice(k*5,k*5+5).map(l=>({label:l.text.slice(0,14),value:num(l.text),ref:l.id,tag:"",note:""}));rows.push({label:"가짜 숫자",value:"+999%",ref:"F1",tag:"",note:""});cards.push({kicker:"관찰 "+(k+1),title:"핵심 [["+(rows[0]?rows[0].value:"")+"]]\n이렇게 읽어요",lead:"초보도 이해하게 풀어 쓴 설명.",sub:"근거: 앱 카드",rows,takeaway:"숫자보다 흐름을 보기"});}J({ok:true,model:"mock",out:{cards,question:"가장 의외였던 숫자는?"}});});return;}
 if(u.pathname==="/api/channel"&&u.searchParams.get("op")==="archive"){global.ARCH=global.ARCH||{idx:[],rec:{}};const A=global.ARCH;
   if(req.method!=="POST"){const id=u.searchParams.get("id");if(id)return J({ok:true,id,text:A.rec[id]||""});return J({ok:true,items:A.idx,total:A.idx.length});}
   let body="";req.on("data",c=>body+=c);req.on("end",()=>{let b={};try{b=JSON.parse(body)}catch(e){}
     const slim=r=>({id:r.id,at:r.at,kind:r.kind,mod:r.mod,modName:r.modName,sym:r.sym||null,name:r.name,scope:r.scope,title:r.title,p:r.p||{},snap:r.snap||null,tags:r.tags||[],note:r.note||"",size:(r.text||"").length});
     if(b.act==="save"||b.act==="import"){const recs=b.act==="import"?b.items:[b.rec];const saved=[];recs.forEach(r=>{if(!r||!r.text)return;const id=r.id||Date.now().toString(36);const e=slim(Object.assign({},r,{id,at:r.at||Date.now()}));A.rec[id]=r.text;A.idx=A.idx.filter(x=>x.id!==id);A.idx.unshift(e);saved.push(e);});A.idx.sort((a,b2)=>b2.at-a.at);return J({ok:true,items:saved,item:saved[0]||null,total:A.idx.length});}
     if(b.act==="del"){A.idx=A.idx.filter(x=>x.id!==b.id);delete A.rec[b.id];return J({ok:true});}
     if(b.act==="upd"){const e=A.idx.find(x=>x.id===b.id);if(e&&b.note!=null)e.note=b.note;return J({ok:true,item:e});}
     return J({ok:false,reason:"BAD_ACT"});});return;}
 if(u.pathname==="/api/channel")return J({ok:true,text:"📈 미국 증시 데일리 브리핑 — 9.30(수) 마감\n\n■ 지수\nS&P500 +0.2% · 나스닥 +0.2%\nVIX 18.4 (평온)\n\n■ 종목 (오른 종목 53%)\n▲ 테슬라 +2.0%, 캐터필러 +1.8%\n▼ 컴캐스트 -2.0%\n\n※ 종가 기준 자동 집계.",generated:"2026-10-01T00:00:00Z",telegram:false});
 if(u.pathname==="/api/snap"&&u.searchParams.get("manifest")==="1"){const m={generated:new Date().toISOString(),recentDays:90,complete:true,symbols:{}};Object.keys(NAMES).forEach(k=>m.symbols[k]={history:"2026-09-28",updated:"2026-09-29"});return J(m);}
 if(u.pathname==="/api/snap"&&u.searchParams.get("symbol")){const sym=u.searchParams.get("symbol");const d=series(sym,/^(\^KS11|SPY|QQQ|GLD|TLT|BTC-USD|005930\.KS|000660\.KS|NVDA|AAPL|TSLA|MSFT|KRW=X|\^GSPC)$/.test(sym)?9000:2500);return J({s:sym,meta:d.meta,t:d.t,o:d.c,h:d.c,l:d.c,c:d.c,a:d.c,v:d.v,div:d.div,updated:"2026-09-28"});}
 if(u.pathname==="/api/snap"&&u.searchParams.get("popular")==="1")return J({ok:true,items:[{s:"NVDA",score:42},{s:"005930.KS",score:30},{s:"TSLA",score:22},{s:"BTC-USD",score:15},{s:"000660.KS",score:12},{s:"PLTR",score:9},{s:"SPY",score:7},{s:"XRP-USD",score:5}]});
 if(u.pathname==="/api/owner")return J({ok:true});
 if(u.pathname==="/api/hit"){hits.push(u.search);return J({ok:true});}
 if(u.pathname==="/api/chart"){const s=u.searchParams.get("symbol");const d=series(s,2500);return J({chart:{result:[{meta:d.meta,timestamp:d.t,indicators:{quote:[{close:d.c,open:d.c,high:d.c,low:d.c,volume:d.v}],adjclose:[{adjclose:d.c}]}}]}});}
 if(u.pathname==="/api/news"&&u.searchParams.get("type")==="raw"){const q=u.searchParams.get("q");const T=[["삼성전자 목표주가 상향…HBM 수혜 기대","한국경제","증권사가 목표주가를 350만원으로 올렸다."],["삼성전자, 실적 부진 우려에 목표가 하향","이데일리","목표주가 280만원으로 내렸다."],["\"지금이 저가 매수 기회\" 애널리스트 매수 의견 유지","매일경제",""],["반도체 업황 둔화 경고…하락 리스크","서울경제",""],["삼성전자 반등 가능성, 외국인 복귀","뉴시스",""],["코스피 전망 엇갈려…상승 vs 조정","연합뉴스",""],["삼성전자 주가 전망 중립","머니투데이",""]];return J({ok:true,items:T.map(x=>({title:x[0],press:x[1],time:"2026-10-15",url:"#",desc:x[2]}))});}
 if(u.pathname==="/api/news"){const q=u.searchParams.get("q"),cat=u.searchParams.get("cat");const D="주가가 장 초반 급등했다. 증권가는 3분기 실적이 시장 예상치를 웃돌 것으로 보고 목표주가를 잇달아 올렸다. 외국인과 기관이 동반 순매수에 나섰다.";
  const M={main:[["코스피, 외국인 매수에 상승 마감…관세 협상 기대","뉴시스","코스피가 외국인 순매수에 힘입어 0.5% 오른 채 마감했다. 한미 관세 협상 타결 기대감이 투자 심리를 끌어올렸다는 분석이다."],["반도체 HBM 수요 급증에 SK하이닉스·삼성전자 강세","매일경제","고대역폭메모리(HBM) 수요가 예상을 웃돌면서 SK하이닉스와 삼성전자가 나란히 강세를 보였다. 증권가는 4분기에도 공급 부족이 이어질 것으로 전망했다."],["[속보] 코스닥 1000 돌파","연합뉴스",""],["조선 3사, 美 해군 MRO 수주 기대에 동반 강세","서울경제","한화오션·HD현대중공업·삼성중공업이 미 해군 함정 정비 사업 수주 기대감에 일제히 올랐다."]],
  world:[["뉴욕증시, 고용 둔화 우려에 하락…나스닥 1.2%↓","연합뉴스","뉴욕증시 3대 지수가 고용 지표 둔화에 따른 경기 우려로 일제히 하락했다. 대형 기술주가 낙폭을 키웠다."],["엔비디아, 신제품 공개에도 차익실현 매물","한국경제","엔비디아가 차세대 칩을 공개했지만 주가는 2% 넘게 내렸다. 기대가 선반영됐다는 평가다."]],
  fx:[["원달러 환율 1,380원대 마감, 달러 약세","한국경제","원·달러 환율이 전날보다 6.2원 내린 1,381.5원에 마감했다. 달러 약세와 외국인 주식 순매수가 겹치며 환율을 끌어내렸다."]],
  rate:[["연준, 기준금리 동결…연내 인하 기대는 유지","연합뉴스","미국 연방준비제도가 기준금리를 연 4.25~4.50%로 동결했다. 파월 의장은 물가가 목표에 근접하고 있다며 연내 인하 가능성을 열어뒀다."],["한은 기준금리 인하 가능성 시사","이데일리","한국은행 총재가 물가 안정세를 근거로 추가 금리 인하 가능성을 시사했다. 다만 가계부채와 환율을 고려해 속도는 조절하겠다고 밝혔다."]]};
  const items=u.searchParams.get("type")==="stock"?[{title:q+", 3분기 실적 기대감에 급등…증권가 목표가 상향",press:"한국경제",time:"2026-09-29",url:"#",desc:q+" "+D},{title:q+" 주가 급변동, 외국인 순매수 전환",press:"연합뉴스",time:"2026-09-29",url:"#",desc:""}]:(M[cat]||M.main).map(x=>({title:x[0],press:x[1],time:"2026-10-06",url:"#",desc:x[2]}));return J({ok:true,items});}
if(u.pathname==="/api/fund"){const sym=u.searchParams.get("symbol");const kr=/\.K[SQ]$/.test(sym);const P=["2022.12","2023.12","2024.12","2025.12(E)","2026.12(E)"];const per=(ks)=>({periods:P.map((t,i)=>({title:t,key:"k"+i,forecast:i>=3})),rows:ks.map(([title,vals])=>({title,values:Object.fromEntries(vals.map((v,i)=>["k"+i,v]))}))});
  const A=per([["매출액",[2580000,2589000,3009000,3200000,3450000]],["영업이익",[433000,65000,328000,420000,520000]],["영업이익률",[16.8,2.5,10.9,13.1,15.1]],["당기순이익",[556000,154000,344000,380000,460000]],["ROE",[17.1,4.1,8.9,9.5,10.8]],["ROA",[12.7,3.4,7.1,null,null]],["부채비율",[26.4,25.4,27.9,null,null]],["유동비율",[278,258,251,null,null]],["영업활동현금흐름",[621000,441000,732000,null,null]],["잉여현금흐름",[90000,-120000,230000,null,null]]]);
  const Q=per([["매출액",[770000,740000,790000,820000,850000]],["영업이익",[90000,60000,95000,110000,125000]],["당기순이익",[70000,50000,80000,90000,100000]],["EPS",[1030,740,1180,1320,1470]]]);Q.periods=["2025.06","2025.09","2025.12","2026.03","2026.06(E)"].map((t,i)=>({title:t,key:"k"+i,forecast:i>=4}));
  return J({ok:true,market:kr?"KR":"US",info:{marketValue:{value:"4,500,000억"},per:{value:"31.79"},cnsPer:{value:"14.6"},eps:{value:"6,605"},cnsEps:{value:"45,521"},pbr:{value:"1.28"},roe:{value:"8.9"},foreignRate:{value:"52.3"},dividendYieldRatio:{value:"2.1"}},industry:{industryName:"반도체와반도체장비",per:"18.2"},consensus:{priceTargetMean:"90000"},finance:{annual:A,quarter:Q}});}
 if(u.pathname==="/api/snap"&&u.searchParams.get("macro")==="1")return J(MACD);
 if(u.pathname.startsWith("/api/"))return J({ok:false});
 let f=path.join(ROOT,u.pathname==="/"?"index.html":u.pathname);if(!fs.existsSync(f)){res.writeHead(404);return res.end();}
 res.writeHead(200,{"Content-Type":f.endsWith(".js")?"text/javascript":"text/html; charset=utf-8"});fs.createReadStream(f).pipe(res);});
// 오염 데이터 주입: 오래된 종목(10일 전 마감), 하루 +55% 급등 오류
{const s=recent.symbols["AMD"];s.t=s.t.map(x=>x-10*86400);}
{const s=recent.symbols["INTC"];const n=s.c.length;s.c[n-1]=+(s.c[n-2]*1.55).toFixed(2);}

(async()=>{await new Promise(r=>server.listen(8798,r));const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--no-sandbox"]});
 const errs=[];const mk=async(w,h)=>{const ctx=await b.newContext({viewport:{width:w,height:h},locale:"ko-KR"});const p=await ctx.newPage();p.on("pageerror",e=>errs.push(w+" "+e.message));
  await p.route("**/cdn.jsdelivr.net/**",route=>{const url=route.request().url();const map={"chart.umd.min.js":"chart.js/dist/chart.umd.js","hammer.min.js":"hammerjs/hammer.min.js","chartjs-plugin-zoom.min.js":"chartjs-plugin-zoom/dist/chartjs-plugin-zoom.min.js"};const k=Object.keys(map).find(k=>url.includes(k));if(k&&fs.existsSync(path.join(NM,map[k])))return route.fulfill({path:path.join(NM,map[k]),contentType:"text/javascript"});route.fulfill({body:"",contentType:"text/javascript"});});
  await p.route("**/clarity.ms/**",r=>r.fulfill({body:""}));
  await p.addInitScript(()=>{try{localStorage.setItem("sm.storageWarnDismissed","1");localStorage.setItem("sm.cloudOfferDismissed","1");localStorage.setItem("sm.owner","TOK");localStorage.setItem("stockmind.holdings",JSON.stringify({v:1,lots:[{s:"005930.KS",q:50,p:70000,d:"2025-01-10"},{s:"000660.KS",q:10,p:180000,d:"2025-03-10"},{s:"NVDA",q:5,p:120,d:"2025-02-01",fx:1400}]}));}catch(e){}});
  await p.goto("http://localhost:8798/",{waitUntil:"networkidle"});await p.evaluate(()=>switchTab("brief"));await p.waitForTimeout(2500);return p;};
 const OVL=()=>{const root=document.getElementById("tab-analyst");const W=document.documentElement.clientWidth;const boxes=[];const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=walker.nextNode())){if(!n.textContent.trim())continue;const el=n.parentElement;if(el.closest("[hidden]")||el.closest("details:not([open])>:not(summary)"))continue;const r=document.createRange();r.selectNodeContents(n);let cl={left:-1e9,top:-1e9,right:1e9,bottom:1e9};for(let a=el;a&&a!==document.body;a=a.parentElement){const s=getComputedStyle(a);if(s.overflowX!=="visible"||s.overflowY!=="visible"){const q=a.getBoundingClientRect();cl={left:Math.max(cl.left,q.left),top:Math.max(cl.top,q.top),right:Math.min(cl.right,q.right),bottom:Math.min(cl.bottom,q.bottom)};}}[...r.getClientRects()].forEach(b0=>{const b={left:Math.max(b0.left,cl.left),top:Math.max(b0.top,cl.top),right:Math.min(b0.right,cl.right),bottom:Math.min(b0.bottom,cl.bottom)};if(b.right-b.left>1&&b.bottom-b.top>1)boxes.push({el,b,t:n.textContent.trim().slice(0,24)});});}
  const bad=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],c=boxes[j];if(a.el===c.el||a.el.contains(c.el)||c.el.contains(a.el))continue;const ox=Math.min(a.b.right,c.b.right)-Math.max(a.b.left,c.b.left),oy=Math.min(a.b.bottom,c.b.bottom)-Math.max(a.b.top,c.b.top);if(ox>2&&oy>3)bad.push(a.t+" ⟷ "+c.t);}
  const out=[];root.querySelectorAll("*").forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.right>W+1)out.push((e.className||e.tagName)+":"+Math.round(r.right));});return {bad:[...new Set(bad)].slice(0,10),out:[...new Set(out)].slice(0,8)};};
 const SAMPLE=`## 서술형
삼성전자는 지금 '관심 · 분할' 구간입니다.

【핵심 사업모델과 수익원】 반도체(DS)·모바일(MX)·디스플레이가 세 축입니다.

종합: 숫자는 싸고 전망은 조건부입니다.

## 카드형
제목: 삼성전자, 싸지만 조건부
한 줄: 밸류는 싸고 이익 전망은 조건부 — 나눠서
항목: 핵심 사업모델과 수익원 | △ | 반도체·모바일·디스플레이 세 축 | 2024 매출 300.9조원(사업보고서) | 돈은 반도체가 번다
항목: 경쟁력과 성장 동력 | △ | HBM·파운드리가 열쇠 | 3년 매출 CAGR +8.0%(앱) | 성장주라기엔 완만
항목: 3~5년 실적 전망 | ✓ | 2026 매출 345조 전망 | 확정 대비 +15%(컨센서스) | 메모리 회복이 전제
항목: 적정 가치와 주요 리스크 | ✓ | 업종보다 싼 PER | 14.6배 vs 18.2배(네이버) | 전망 하향이 최대 리스크
종합: ✓ | 숫자는 싸고 전망은 조건부입니다.
변화: 상향 | 이익 전망이 올라왔다
리스크: 메모리 가격 재하락 / 파운드리 적자 지속 / 환율 급변
확인할 것: 다음 분기 영업이익률 / HBM 공급 계약 / 외국인 수급
출처: 네이버 증권 2026.10`;
 global.ARCH={idx:[],rec:{}};
 const p0=await mk(1280,900);await p0.evaluate(()=>switchTab("analyst"));await p0.waitForSelector("#anBody .anGrid",{timeout:60000});
 await p0.evaluate(()=>{AN.mod="biz";AN.sym="005930.KS";anRun();});await p0.waitForFunction(()=>!AN.busy,{timeout:120000});
 // 8건: 앱 규칙 1번(사업모델) ✓였는데 이후 하락(빗나감) 6건 · 상승 2건 / 4번(가치) ✓ 뒤 상승 7건
 const n=await p0.evaluate(()=>{const rows=rpRows("005930.KS"),last=rows[rows.length-1].c;const recs=[];for(let k=0;k<8;k++){const up=k<2;const price=up?last*0.9:last*1.1;const txt="## 카드형\n제목: 기록 "+k+"\n한 줄: 테스트\n항목: 핵심 사업모델과 수익원 | ✓ | a | b | c\n항목: 적정 가치와 주요 리스크 | "+(up?"✓":"✗")+" | a | b | c\n종합: ✓ | 검토\n리스크: a\n확인할 것: b";recs.push({id:"seed"+k,at:Date.now()-(30+k*5)*86400e3,kind:"analyst",mod:"biz",modName:"기업 분석",sym:"005930.KS",name:"삼성전자",scope:"module",title:"기록 "+k,text:txt,p:anParse(txt),snap:{price,key:{},rows:[],ck:["ok","mid","na",up?"ok":"bad"]},tags:[]});}return arcApi({act:"import",items:recs}).then(()=>arcLoad(true)).then(L=>L.length);});
 console.log("seeded",n);
 await p0.evaluate(()=>{AN.arcPairs=null;renderAnalyst();});await p0.waitForFunction(()=>ARC_CAL.data&&ARC_CAL.data.n>=8,{timeout:60000});await p0.waitForTimeout(400);await p0.evaluate(()=>renderAnalyst());await p0.waitForTimeout(300);
 console.log("CALIB:",JSON.stringify(await p0.evaluate(()=>({n:ARC_CAL.data.n,rule:ARC_CAL.data.rule.map(o=>o.name+" "+o.hit+"/"+o.n+" "+o.grade+" w"+o.w),ai:ARC_CAL.data.ai.map(o=>o.name+" "+o.hit+"/"+o.n+" "+o.grade)}))));
 console.log("ANCOUNTER:",await p0.evaluate(()=>(document.querySelector(".anCounter")||{innerText:"(none)"}).innerText.replace(/\s+/g," ").slice(0,500)));
 console.log("PROMPT redteam:",await p0.evaluate(()=>anPromptModule(anMod(),AN.out).split("\n").filter(l=>/반론|보완/.test(l)).join(" || ").slice(0,500)));
 console.log("RULEV:",await p0.evaluate(()=>(document.querySelector(".anRuleV")||{}).innerText));
 console.log("CKS:",await p0.evaluate(()=>[...document.querySelectorAll(".anCks.one .anCk")].map(c=>c.querySelector(".anSt").textContent+" "+c.querySelector("b").innerText.replace(/\s+/g," ")).join(" | ")));
 await p0.click("[data-anprev]");await p0.waitForFunction(()=>{const b=document.querySelector(".anPrBox");return b&&!b.hidden&&b.querySelector("textarea").value.length>500;},{timeout:60000});
 const pr=await p0.evaluate(()=>document.querySelector(".anPrBox textarea").value);const ci=pr.indexOf("[보정 메모");console.log("PROMPT calib:",ci>=0?pr.slice(ci,ci+500):"(none)");
 console.log("CALHTML:",await p0.evaluate(()=>document.querySelector("#anCal").innerText.replace(/\s+/g," ").slice(0,500)));
 await p0.click("[data-ancal]");await p0.waitForTimeout(300);console.log("calib off CKS:",await p0.evaluate(()=>[...document.querySelectorAll(".anCks.one .anCk")].map(c=>c.querySelector(".anSt").textContent).join("")));
 const o=await p0.evaluate(OVL);console.log("ovl 1280",JSON.stringify(o));await p0.screenshot({path:path.join(OUT,"an4-1280.png"),fullPage:true});
 await p0.context().close();
 const p1=await mk(390,844);await p1.evaluate(()=>switchTab("analyst"));await p1.waitForSelector("#anBody .anGrid",{timeout:60000});await p1.evaluate(()=>{AN.mod="biz";AN.sym="005930.KS";anRun();});await p1.waitForFunction(()=>!AN.busy&&document.querySelectorAll(".arcRow").length>=2,{timeout:120000});await p1.waitForTimeout(800);
 console.log("ovl 390",JSON.stringify(await p1.evaluate(OVL)));console.log("EM dbg",await p1.evaluate(()=>[...document.querySelectorAll("#tab-analyst em")].filter(e=>e.getBoundingClientRect().right>391).map(e=>e.className+"|"+e.parentElement.className+"|"+e.textContent.slice(0,30))));await p1.screenshot({path:path.join(OUT,"an3-390.png"),fullPage:true});await p1.context().close();
 console.log("\n오류",errs.length,errs.slice(0,5));await b.close();server.close();})();
