/* ============================================================ v16.00 화면 공통 규칙 — 색 · 글자 · 간격 · 버튼 · 표 · 뼈대 모양
   원칙
   ① 색은 뜻이 있을 때만: 빨강 = 올랐다, 파랑 = 내렸다, 금색 = 지금 위치 · 브랜드, 초록 = 끝냈다 · 확인됐다. 그 밖은 먹색과 회색.
      (예전에는 강조색과 '내렸다' 색이 같은 파랑이라 버튼과 하락 숫자가 구분되지 않았다)
   ② 그림자 대신 가는 선. 떠 있는 것(메뉴 · 검색 결과 · 창)만 그림자를 쓴다.
   ③ 모서리는 크기에 따라: 화면 칸 14 · 작은 칸 10 · 버튼 9 · 알약 999.
   ④ 숫자는 폭이 같은 글자로(자릿수가 위아래로 맞게).
   ⑤ 밖으로 내보내는 결과물(PDF 덱 · 카드)은 건드리지 않는다 — 덱 안에서는 예전 색 값을 그대로 고정한다.
   기본 규칙(index.html)과 같은 무게(:where)로 써서, 각 화면이 따로 정한 모양은 그대로 이긴다.
   ============================================================ */
(function () {
  var N = ":where(:not(#ddDeck *,.ddS *))";          // 덱(PDF · 이미지 내보내기) 안쪽은 제외
  var W = ":where(html.sh) ";
  var C = [
    /* ---------- 색 · 크기 ---------- */
    ":root{--bg:#f3f4f6;--card:#fff;--card2:#f1f2f4;--soft:#f7f8f9;--line:#e3e6ea;--line2:#eef0f2;--txt:#14161c;--txt2:#3d4452;--sub:#667080;--muted:#98a0ad;",
    "--up:#d9342b;--down:#2f6fd6;--upSoft:#fdeeed;--downSoft:#ebf2fd;--accent:#14161c;--accentSoft:#eceef1;--good:#1d7f55;--goodSoft:#e8f5ee;--goodLine:#bfe3cf;--warn:#b9600f;--warnSoft:#fdf3e3;--warnLine:#f1d9ae;--bad:#c03b3b;--badSoft:#fcefef;--badLine:#f3c9c9;--runSoft:#edf1fd;",
    "--ink:#14161c;--run:#4a6fd8;--gold:#c9a24f;--goldInk:#8a6a1f;--goldSoft:#f7f0de;--goldLine:#e6d3a3;--r-card:14px;--r-ctl:9px;",
    "--admBg:var(--bg);--admCard:#fff;--admLine:var(--line);--admTxt:var(--txt);--admSub:var(--sub);--admMute:var(--muted);--admAcc:var(--txt);--admInk:#14161c;--admGold:#c9a24f;--admSoft:var(--soft);",
    "--shRail:76px;--shTopH:56px;--shStick:46px;--shPad:14px}",
    "#ddDeck,.ddS{--bg:#f2f4f6;--card:#ffffff;--card2:#f2f4f6;--soft:#f9fafb;--line:#e5e8eb;--txt:#191f28;--txt2:#4e5968;--sub:#8b95a1;--up:#f04452;--down:#3182f6;--accent:#3182f6;--accentSoft:#e8f3ff;--good:#03a15b;--r-card:20px;--r-ctl:12px}",

    /* ---------- 상태 색 · 흐린 글자 한 벌로 (v16.10)
       각 화면이 따로 쓰던 초록 20여 가지 · 빨강 12가지 · 주황 6가지와 너무 흐린 회색 글자를, 화면(탭 · 창) 안에서만 한 값으로 모은다.
       원본에는 var(--k-원래색, #원래색) 꼴로 적혀 있어서, 이 줄이 닿지 않는 곳(PDF 덱 · 카드 · 저장 이미지)은 원래 색 그대로다. ---------- */
    "html.sh [id^=\"tab-\"],html.sh .modalWrap,html.sh #clDrawer,html.sh #smToasts,html.sh .banners{--k-03a15b:var(--good);--k-157347:var(--good);--k-15803d:var(--good);--k-176b36:var(--good);--k-178a47:var(--good);--k-1d7f55:var(--good);--k-1f7a45:var(--good);--k-1f8a5b:var(--good);--k-1fa463:var(--good);--k-2e7d4f:var(--good);--k-a12b2b:var(--bad);--k-b42318:var(--bad);--k-b4342b:var(--bad);--k-b45309:var(--warn);--k-b91c1c:var(--bad);--k-b9600f:var(--warn);--k-bfe3cc:var(--goodLine);--k-bfe3cf:var(--goodLine);--k-c0303e:var(--bad);--k-c0392b:var(--bad);--k-c03b3b:var(--bad);--k-c2410c:var(--warn);--k-c6f0d8:var(--goodLine);--k-d64545:var(--bad);--k-dc2626:var(--bad);--k-e2f4ea:var(--goodSoft);--k-e3f3e8:var(--goodSoft);--k-e3f4e6:var(--goodSoft);--k-e5484d:var(--bad);--k-e7f5ee:var(--goodSoft);--k-e7f6ec:var(--goodSoft);--k-eef6ef:var(--goodSoft);--k-eef8f2:var(--goodSoft);--k-effaf3:var(--goodSoft);--k-f0fbf4:var(--goodSoft);--k-f3f8f4:var(--goodSoft);--k-f3faf6:var(--goodSoft);--k-fcefef:var(--badSoft);--k-fde7e7:var(--badSoft);--k-fde8e6:var(--badSoft);--k-fde8ea:var(--badSoft);--k-fdecee:var(--badSoft);--k-ffd8dc:var(--badLine);--k-fff1f2:var(--badSoft);--k-fff3f3:var(--badSoft);--k-fff5f6:var(--badSoft);--k-fff7f6:var(--badSoft);--k-fff8f8:var(--badSoft);--t-8a92a3:var(--sub);--t-8a93a3:var(--sub);--t-8b95a1:var(--sub);--t-9aa3b2:var(--sub);}",
    /* ---------- 뼈대 ---------- */
    "html.sh body{background:var(--bg);color:var(--txt);font-size:14.5px;line-height:1.6;max-width:none;margin:0;padding:0 var(--shPad) calc(84px + var(--sab,0px))}",
    "html.sh .topbar,html.sh #watchTabs{display:none!important}",
    /* 위쪽 바와 표의 열 이름이 화면에 붙어 있으려면 body가 따로 스크롤 상자가 되면 안 된다.
       예전 규칙(html, body 둘 다 overflow-x:hidden)이 그렇게 만들고 있어서 붙지 않고 같이 올라가 버렸다 → 옆 넘침은 '자르기'로만 막는다. */
    "html.sh body{overflow-x:clip;overflow-y:visible}",
    "html.sh [id^=\"tab-\"]{max-width:1400px;margin-left:auto;margin-right:auto}",
    "html.shLock{overflow:hidden}",
    ".shIc{display:block;flex:none}",
    "#shTop{position:sticky;top:-52px;z-index:140;display:flex;flex-wrap:wrap;align-items:center;background:#fff;border-bottom:1px solid var(--line);margin:0 calc(var(--shPad) * -1) 14px;padding:0 6px 0 12px}",
    ".shApp{display:contents}",
    ".shBrand{display:flex;align-items:center;gap:8px;height:52px;border:0;background:none;padding:0 6px 0 0;cursor:pointer;color:var(--txt);font:inherit}.shBrand img{border-radius:8px;display:block}.shBrand b{font-size:17px;font-weight:800;letter-spacing:-.02em}",
    ".shAppSp{flex:1}.shBrand:hover,.shLogo:hover,.shLink:hover,.shFindX:hover{background:none}",
    ".shIb{display:grid;place-items:center;width:42px;height:42px;border:0;background:none;border-radius:10px;color:var(--txt2);cursor:pointer;padding:0}.shIb:hover{background:var(--soft);color:var(--txt)}",
    ".shCrumb{display:none}",
    ".shBarRow{display:contents}",
    ".shTabs{order:10;flex:0 0 calc(100% + 18px);margin:0 -6px 0 -12px;display:flex;gap:0;overflow-x:auto;scrollbar-width:none;padding:0 6px;border-top:1px solid var(--line2);min-width:0}.shTabs::-webkit-scrollbar{display:none}",
    ".shTabs button{position:relative;flex:none;border:0;background:none;padding:0 11px;height:44px;font:inherit;font-size:14.5px;font-weight:600;color:var(--sub);cursor:pointer;white-space:nowrap;border-radius:0}.shTabs button:hover{color:var(--txt)}.shTabs button.on{color:var(--txt);font-weight:750}",
    ".shTabs button.on::after{content:\"\";position:absolute;left:11px;right:11px;bottom:0;height:3px;background:var(--gold);border-radius:3px 3px 0 0}",
    ".shDone{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--good);margin:0 0 2px 5px;vertical-align:middle}",
    ".shTools{display:contents}",
    ".shActs{order:3;display:flex;align-items:center}",
    "#shTop>.shApp>[data-shfind]{order:2}#shTop [data-shmenu]{order:4}",
    ".shAct{display:grid!important;place-items:center;width:42px;height:42px;border:0!important;background:none!important;border-radius:10px!important;color:var(--txt2)!important;cursor:pointer;padding:0!important;box-shadow:none!important;font:inherit}.shAct.hidden{display:none!important}.shAct span{display:none}.shAct:hover{background:var(--soft)!important;color:var(--txt)!important}#cloudBtn.shAct.synced{color:var(--good)!important}",
    /* 검색 */
    ".shFind{display:none;position:absolute;left:0;right:0;top:0;z-index:3;background:#fff;padding:8px 10px}#shTop.finding .shFind{display:block}",
    ".shFindIn{display:flex;align-items:center;gap:8px;height:36px;padding:0 6px 0 10px;border:1px solid var(--line);border-radius:9px;background:var(--soft);color:var(--sub);cursor:text}.shFindIn:focus-within{background:#fff;border-color:var(--txt);box-shadow:0 0 0 3px rgba(201,162,79,.3)}",
    "#shQ{flex:1;min-width:0;width:auto;border:0;background:none;padding:0;font:inherit;font-size:15px;color:var(--txt);outline:none;border-radius:0;box-shadow:none;-webkit-appearance:none;appearance:none}#shQ::-webkit-search-cancel-button{display:none}html.sh #shTop #shQ:focus-visible{outline:none}#shQ::placeholder{color:var(--muted)}",
    ".shFindIn kbd{display:none;font:inherit;font-size:11.5px;font-weight:700;color:var(--muted);border:1px solid var(--line);border-radius:5px;padding:0 6px;background:#fff;line-height:18px}",
    ".shFindX{display:grid;place-items:center;width:30px;height:30px;border:0;background:none;color:var(--sub);cursor:pointer;padding:0;border-radius:8px}",
    ".shFindBox{position:absolute;top:100%;left:0;right:0;max-height:min(70vh,520px);overflow:auto;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 14px 30px rgba(20,22,28,.14);padding:6px}.shFindBox[hidden]{display:none}",
    ".shFg{font-size:12px;font-weight:700;color:var(--sub);padding:8px 10px 4px}",
    ".shFi{display:flex;align-items:baseline;gap:10px;width:100%;border:0;background:none;border-radius:8px;padding:9px 10px;text-align:left;cursor:pointer;font:inherit;color:var(--txt)}.shFi b{font-size:14.5px;font-weight:650;flex:1;min-width:0;word-break:keep-all}.shFi small{font-size:12px;color:var(--sub);flex:none;font-variant-numeric:tabular-nums}.shFi:hover,.shFi.at{background:var(--soft)}.shFi.at{box-shadow:inset 3px 0 0 var(--gold)}",
    ".shFe{padding:14px 12px;font-size:13px;color:var(--sub)}.shFe:empty{display:none}",
    /* 아래쪽 메뉴(휴대폰) */
    "#shRail{display:none}.shHelp{display:none!important}html.sh.shHasHelp #clFab{display:none!important}.shMenuFL{display:flex;gap:14px}",
    "#shBar{position:fixed;left:0;right:0;bottom:var(--tabLift,0px);z-index:150;display:grid;grid-template-columns:repeat(var(--n,5),1fr);background:rgba(255,255,255,.97);border-top:1px solid var(--line);padding:5px 4px calc(4px + var(--sab,0px))}",
    "#shBar button{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;border:0;background:none;padding:6px 0 5px;color:#8a92a0;font:inherit;cursor:pointer;border-radius:10px}#shBar button span{font-size:11px;font-weight:650;line-height:1.2}#shBar button.on{color:var(--txt)}",
    "#shBar button.on::before{content:\"\";position:absolute;top:-6px;left:50%;width:22px;height:3px;margin-left:-11px;border-radius:0 0 3px 3px;background:var(--gold)}",
    /* 전체 메뉴 */
    "#shMenu{position:fixed;inset:0;z-index:600}#shMenu[hidden]{display:none}.shMenuBg{position:absolute;inset:0;background:rgba(20,22,28,.46)}",
    ".shMenuBox{position:absolute;left:0;right:0;bottom:0;max-height:88vh;overflow:auto;background:#fff;border-radius:18px 18px 0 0;padding:4px 14px calc(14px + var(--sab,0px))}",
    ".shMenuH{display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#fff;padding:8px 0 2px 4px;z-index:1}.shMenuH b{font-size:17px;font-weight:800;letter-spacing:-.02em}",
    ".shMenuG section{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:2px 6px;padding:10px 0;border-top:1px solid var(--line2)}.shMenuG section:first-child{border-top:0}",
    ".shMenuG h3{grid-column:1/-1;display:flex;align-items:center;gap:7px;font-size:13px;font-weight:750;color:var(--sub);margin:0 0 2px 4px}",
    ".shMenuG button{display:block;width:100%;border:0;background:none;text-align:left;white-space:normal;border-radius:10px;padding:8px 10px;cursor:pointer;font:inherit;color:var(--txt)}.shMenuG button b{display:block;font-size:15px;font-weight:700;letter-spacing:-.01em}.shMenuG button small{display:block;font-size:12.5px;color:var(--sub);line-height:1.4;word-break:keep-all}.shMenuG button:hover{background:var(--soft)}.shMenuG button.on{background:var(--goldSoft)}.shMenuG button.on b{color:var(--goldInk)}",
    ".shMenuF{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line2);padding:10px 4px 0;font-size:12px;color:var(--muted)}.shLink{border:0;background:none;padding:0;font:inherit;font-size:12.5px;color:var(--sub);text-decoration:underline;cursor:pointer}",
    "html.sh :is(#shTop,#shRail,#shBar,#shMenu) :is(button,input):focus-visible{outline:2px solid var(--gold);outline-offset:-2px}",
    "@media(max-width:1023px){.shTabs{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent);padding-right:22px}html.sh #clFab{bottom:calc(74px + var(--sab,0px))}}html.sh .clTabBar,html.sh .egTabBar{top:var(--shStick)}",

    /* ---------- PC ---------- */
    "@media(min-width:1024px){",
    ":root{--shPad:32px;--shStick:var(--shTopH)}",
    "html.sh body{padding:0 var(--shPad) 64px calc(var(--shRail) + var(--shPad))}",
    /* v16.30 왼쪽 메뉴 — 흰 바탕. 접은 모양(아이콘 + 갈래 이름, 올리면 화면 목록)이 기본 규칙이고 펼친 모양(html.shWide)이 그 위에 얹힌다 */
    "#shRail{display:flex;flex-direction:column;align-items:stretch;position:fixed;left:0;top:0;bottom:0;width:var(--shRail);background:#fff;border-right:1px solid var(--line);z-index:150;padding:0}",
    ".shHead{display:flex;align-items:center;justify-content:center;height:var(--shTopH);flex:none;border-bottom:1px solid var(--line2)}",
    ".shLogo{display:flex;align-items:center;gap:10px;border:0;background:none;padding:2px;cursor:pointer;border-radius:12px;line-height:0;min-width:0}.shLogo img{display:block;border-radius:10px;width:36px;height:36px}.shLogo b{display:none;font-size:17px;font-weight:800;letter-spacing:-.02em;color:var(--txt);line-height:1.2}",
    ".shSecs{display:flex;flex-direction:column;gap:2px;width:100%;padding-top:8px}.shSec{position:relative}",
    ".shSecB{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;border:0;background:none;color:var(--sub);padding:10px 0 9px;cursor:pointer;font:inherit;border-radius:0}.shSecB span{font-size:11.5px;font-weight:650;letter-spacing:-.01em;line-height:1.2}.shSecB small{display:none}",
    ".shSecB:hover,.shSec:hover .shSecB{color:var(--txt);background:var(--soft)}.shSec.on .shSecB{color:var(--txt)}.shSec.on .shSecB .shIc{color:var(--goldInk)}.shSec.on .shSecB::before{content:\"\";position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:0 3px 3px 0;background:var(--gold)}",
    ".shFly{display:none;position:absolute;left:100%;top:-4px;padding-left:8px;z-index:2}#shRail:not(.quiet) .shSec:hover .shFly{display:block}.shSec:has(:focus-visible) .shFly{display:block}",
    ".shFlyIn{min-width:184px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 14px 34px rgba(20,22,28,.18);padding:6px}.shFlyIn>b{display:block;font-size:12px;font-weight:700;color:var(--sub);padding:6px 10px 4px}",
    ".shFlyIn button{position:relative;display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;border-radius:8px;padding:8px 10px;font:inherit;font-size:14px;font-weight:600;color:var(--txt2);cursor:pointer;text-align:left;white-space:nowrap}.shFlyIn button .shIc{flex:none;color:var(--muted)}.shFlyIn button span{flex:1 1 auto;min-width:0}.shFlyIn button:hover{background:var(--soft);color:var(--txt)}.shFlyIn button:hover .shIc{color:var(--sub)}",
    ".shFlyIn button.on{background:var(--goldSoft);color:var(--txt);font-weight:700}.shFlyIn button.on .shIc{color:var(--goldInk)}.shFlyIn em{flex:none;font-style:normal;font-size:11px;font-weight:700;color:var(--good)}",
    ".shRailFoot{margin-top:auto;width:100%;flex:none;border-top:1px solid var(--line2);padding:4px 0}.shRailFoot .shSecB{padding:8px 0 7px}.shRailFoot .shSecB span{font-size:11px}",
    /* 펼친 모양 */
    "html.shWide{--shRail:236px}",
    "html.shWide .shHead{justify-content:flex-start;padding:0 14px 0 18px}html.shWide .shLogo img{width:30px;height:30px;border-radius:8px}html.shWide .shLogo b{display:block}",
    "html.shWide .shSecs{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;gap:0;padding:6px 10px 18px;scrollbar-width:thin;scrollbar-color:var(--line) transparent}",
    "html.shWide .shSecB{flex-direction:row;align-items:baseline;gap:8px;padding:14px 10px 5px;color:var(--txt);border-radius:8px;text-align:left}html.shWide .shSecB .shIc{display:none}html.shWide .shSecB span{font-size:12.5px;font-weight:750;white-space:nowrap}html.shWide .shSecB small{display:block;font-size:11.5px;font-weight:500;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:clip;letter-spacing:-.01em}",
    "html.shWide .shSecB:hover,html.shWide .shSec:hover .shSecB{background:none}html.shWide .shSecB:hover span{color:var(--goldInk)}html.shWide .shSec.on .shSecB::before{display:none}",
    "html.shWide .shFly,html.shWide #shRail:not(.quiet) .shSec:hover .shFly{display:block;position:static;padding:0}html.shWide .shFlyIn{min-width:0;border:0;border-radius:0;box-shadow:none;padding:0;background:none}html.shWide .shFlyIn>b{display:none}",
    "html.shWide .shFlyIn button{padding:6.5px 10px 6.5px 13px;margin:1px 0;font-size:14px;font-weight:560;line-height:20px}html.shWide .shFlyIn button.on{font-weight:700}html.shWide .shFlyIn button.on::before{content:\"\";position:absolute;left:0;top:7px;bottom:7px;width:3px;border-radius:3px;background:var(--gold)}",
    "html.shWide .shRailFoot{display:flex;padding:6px 10px}html.shWide .shRailFoot .shSecB{flex-direction:row;justify-content:flex-start;align-items:center;gap:8px;padding:8px 10px;color:var(--sub);border-radius:8px}html.shWide .shRailFoot .shSecB .shIc{display:block;width:17px;height:17px}html.shWide .shRailFoot .shSecB span{font-size:12.5px;font-weight:600}html.shWide .shRailFoot .shSecB:hover{background:var(--soft);color:var(--txt)}html.shWide .shAllB{display:none}",
    /* 펼친 메뉴가 화면 목록을 다 보여 주므로 위쪽 바는 '지금 어디 · 무엇을 하는 화면' 한 줄만 */
    ".shCrumb{display:none}html.shWide .shCrumb{order:1;flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:8px;font-size:14px;color:var(--sub);white-space:nowrap;overflow:hidden}html.shWide .shCrumb span{font-weight:600}html.shWide .shCrumb i{font-style:normal;color:var(--muted)}html.shWide .shCrumb b{font-size:16px;font-weight:750;color:var(--txt);letter-spacing:-.01em}html.shWide .shCrumb small{font-size:13px;color:var(--muted);margin-left:6px;overflow:hidden;text-overflow:ellipsis;min-width:0}",
    "html.shWide .shTabs{display:none}",
    "#shTop{top:0;flex-wrap:nowrap;align-items:stretch;gap:12px;height:var(--shTopH);margin:0 calc(var(--shPad) * -1) 22px;padding:0 var(--shPad) 0 20px}",
    ".shBrand,.shAppSp,#shTop>.shApp>.shIb{display:none}",
    ".shTabs{order:1;flex:1 1 auto;margin:0;padding:0;border-top:0;gap:2px}.shTabs button{height:var(--shTopH);padding:0 12px;font-size:15px}.shTabs button.on::after{left:12px;right:12px}",
    ".shFind{order:2;display:block;position:relative;left:auto;right:auto;top:auto;width:264px;padding:0;align-self:center;background:none}.shFindIn kbd{display:block}.shFindIn:focus-within kbd{display:none}.shFindX{display:none}#shQ{font-size:14px}",
    ".shFindBox{top:calc(100% + 6px);left:auto;right:0;width:360px;border:1px solid var(--line);border-radius:12px}",
    ".shActs{order:3;gap:2px}.shAct{width:auto;height:36px;display:flex!important;align-items:center;gap:6px;padding:0 10px!important;font-size:13px!important;font-weight:650!important;align-self:center}.shAct span{display:inline}.shHelp{display:flex!important}",
    "#shBar{display:none}",
    ".shMenuBox{left:50%;right:auto;bottom:auto;top:7vh;transform:translateX(-50%);width:min(1000px,calc(100vw - 180px));max-height:86vh;border-radius:16px;padding:8px 22px 18px}",
    ".shMenuG{column-count:3;column-gap:26px}.shMenuG section{display:block;break-inside:avoid;border-top:0;padding:10px 0 12px}.shMenuG button{padding:6px 10px}.shMenuG h3{margin-bottom:4px}",
    "}",
    "@media(min-width:1024px) and (max-width:1279px){:root{--shPad:20px}}@media(min-width:901px) and (max-width:1279px){html.sh .rkGs{grid-template-columns:repeat(3,minmax(0,1fr))}}",
    "@media print{#shRail,#shTop,#shBar,#shMenu{display:none!important}html.sh body{padding:0!important}}",

    /* ---------- 공통 부품 (기본 규칙과 같은 무게로 덮어쓴다) ---------- */
    W + ".card" + N + "{border:1px solid var(--line);box-shadow:none;padding:20px 22px 20px}",
    W + ".card" + N + " h2{font-size:18px;font-weight:800;letter-spacing:-.02em;margin-bottom:12px}" + W + ".card" + N + " h3{font-size:15.5px;font-weight:750;margin:20px 0 9px}",
    W + "button" + N + "{font-size:13.5px;padding:9px 14px}",
    W + "button.primary" + N + "{font-weight:700}" + W + "button.primary" + N + ":hover{background:#2c313c}",
    W + "button.chip.active" + N + "," + W + "#finderBox .chip.active," + W + "#mapFilters .chip.active," + W + "#newsFilters .chip.active," + W + "#marketCats .chip.active," + W + ".chartCtrl button.active{background:var(--txt);color:#fff}",
    W + "button.chip" + N + ":hover{background:#e4e6ea;color:var(--txt)}",
    W + "input" + N + "," + W + "select" + N + "{background:#fff;border:1px solid #d6dae1;padding:9px 12px;font-size:14px}",
    W + "input" + N + ":focus," + W + "select" + N + ":focus{border-color:var(--txt);box-shadow:0 0 0 3px rgba(201,162,79,.3)}",
    W + ".pills button" + N + "{box-shadow:none;border:1px solid var(--line);padding:8px 15px;font-size:13.5px}" + W + ".pills button.active" + N + "{border-color:var(--txt)}",
    W + ".badge" + N + "{border-radius:10px}" + W + ".emptyCard{border:1px dashed #d6dae1;background:none}",
    W + ".modalBox," + W + ".cloudBox{border-radius:16px}",
    W + ".iconBtn{box-shadow:none}",
    W + "table" + N + "{font-feature-settings:\"tnum\" 1}",
    "html.sh .footLine{max-width:1400px;margin:8px auto 0;color:var(--muted)}",
    "html.sh [id^=\"tab-\"] .macSpark polyline{stroke:#5a6373;stroke-width:1.4}",
    /* 본질·변수 요약: 깊이 막대(왼쪽 선이 고점, 길수록 깊다) */
    "html.sh [id^=\"tab-\"] .clRow:has(.clDp){grid-template-columns:minmax(110px,200px) minmax(60px,240px) 52px 1fr;align-items:center}html.sh [id^=\"tab-\"] .clRow .clDp{display:block;height:8px;border-left:2px solid #14161c;background:#eceef1;border-radius:0 4px 4px 0;overflow:hidden}html.sh [id^=\"tab-\"] .clRow .clDp u{display:block;height:100%;background:#7aa3ea;border-radius:0 4px 4px 0;text-decoration:none}@media(max-width:700px){html.sh [id^=\"tab-\"] .clRow:has(.clDp){grid-template-columns:minmax(84px,1fr) minmax(44px,90px) 44px auto;gap:8px}}",
    /* 글자를 '…'로 자르던 곳을 풀었다: 실적 화면 머리 숫자 칸, 작업 순서 줄의 '다음 할 일' */
    "html.sh [id^=\"tab-\"] .fuTiles b{white-space:normal;overflow:visible;text-overflow:clip;word-break:keep-all;line-height:1.25}@media(max-width:700px){html.sh [id^=\"tab-\"] .fuTiles b{font-size:18px}}",
    "html.sh [id^=\"tab-\"] .smFlowHint{white-space:normal;overflow:visible;text-overflow:clip;word-break:keep-all;line-height:1.5}",
    /* 작은 숫자 칸: 등락 값은 색으로 먼저 읽히게(예전에는 칸 안 숫자가 전부 검정이었다) */
    "html.sh [id^=\"tab-\"] .badge b.pos{color:var(--up)}html.sh [id^=\"tab-\"] .badge b.neg{color:var(--down)}",
    /* 상태 꼬리표: 화면마다 조금씩 다르던 모서리 · 글자 크기를 한 모양으로 */
    "html.sh [id^=\"tab-\"] :is(.dsTag,.dhBadge,.pkTag,.gyTag,.uxChip,.rkRo){display:inline-flex;align-items:center;gap:3px;font-size:11.5px;font-weight:750;line-height:18px;padding:1px 8px;border-radius:999px;white-space:nowrap;vertical-align:middle}",
    /* 표: 넓은 화면에서는 한 번에 더 많은 줄을 보여 준다(예전에는 어디서나 430px에서 잘렸다). 관심 종목은 화면의 본문이라 자르지 않는다 */
    "@media(min-width:1024px){html.sh [id^=\"tab-\"] .tableWrap{max-height:min(76vh,820px)}}html.sh #wp-list .tableWrap{max-height:none;overflow-y:visible}",
    "html.sh .banners>div{border:1px solid var(--line)!important;box-shadow:none!important;border-radius:12px!important}",
    "html.sh .backPill{background:#14161c!important}",
    "html.sh :is([id^=\"tab-\"],.modalWrap,#cloudModal) :is(button,input,select,textarea,summary,a):focus-visible{outline:2px solid var(--gold);outline-offset:2px}",
    "@media(max-width:1023px){html.sh .card{padding:16px 14px;border-radius:12px}html.sh .modalBox,html.sh .cloudBox{border-radius:18px 18px 0 0}}",
    "@media(prefers-reduced-motion:reduce){html.sh *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}",

    /* ---------- 운영 화면 공통(예전 '운영실' 규칙을 새 색으로 옮김) ---------- */
    "html.sh [id^=\"tab-\"] .pgHead h2,html.sh [id^=\"tab-\"] .admPh h2{font-size:20px;font-weight:800;color:var(--txt);letter-spacing:-.02em;margin:0}html.sh [id^=\"tab-\"] .pgHead h2 small,html.sh [id^=\"tab-\"] .admPh h2 small{display:block;font-size:13px;font-weight:500;color:var(--sub);margin-top:3px;letter-spacing:0}html.sh [id^=\"tab-\"] .admPh{margin:0 2px 14px}",
    "html.sh [id^=\"tab-\"] .mkStep,html.sh [id^=\"tab-\"] .wbStep{font-size:15.5px;font-weight:800;color:var(--txt);margin:18px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}html.sh [id^=\"tab-\"] .mkStep b,html.sh [id^=\"tab-\"] .wbStep b{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:7px;background:#14161c;color:#fff;font-size:12.5px;margin:0}html.sh [id^=\"tab-\"] .mkStep small,html.sh [id^=\"tab-\"] .wbStep small{font-size:12.5px;font-weight:500;color:var(--sub)}",
    "html.sh [id^=\"tab-\"] .anSec{border-top:1px solid var(--line);margin-top:18px;padding-top:6px}",
    "html.sh [id^=\"tab-\"] .briefDim{color:var(--sub)}",
    "html.sh [id^=\"tab-\"] .smFlow{background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px 12px;margin-bottom:12px}html.sh [id^=\"tab-\"] .smFlowHint{color:var(--sub)}",
    "html.sh [id^=\"tab-\"] .smGuide{border:1px solid var(--line);background:#fff;border-radius:12px;padding:8px 14px;margin-bottom:12px}html.sh [id^=\"tab-\"] .smGuide>b{display:flex;align-items:center;gap:8px;margin:0;cursor:pointer;font-size:13.5px}html.sh [id^=\"tab-\"] .smGuide>b small{color:var(--muted);font-weight:500;font-size:12px}html.sh [id^=\"tab-\"] .smGuide ol,html.sh [id^=\"tab-\"] .smGuide [data-goff]{display:none}html.sh [id^=\"tab-\"] .smGuide.open ol{display:block;margin:8px 0 4px}html.sh [id^=\"tab-\"] .smGuide.open [data-goff]{display:inline-block}",
    "html.sh [id^=\"tab-\"] .admQ{background:var(--card2);color:var(--txt)}",
    "html.sh [id^=\"tab-\"] .opsStep{border-radius:14px;border-color:var(--line)}html.sh [id^=\"tab-\"] .opsHead h2{font-size:22px;font-weight:800}",
    "@media(max-width:1023px){html.sh [id^=\"tab-\"] .pgHead h2,html.sh [id^=\"tab-\"] .admPh h2{font-size:18px}}"
  ];
  var st = document.createElement("style"); st.id = "skinCss"; st.textContent = C.join(""); document.head.appendChild(st);
  var tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute("content", "#ffffff");
})();
