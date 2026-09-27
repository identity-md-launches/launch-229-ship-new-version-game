"""Preserve the MIT prototype scene; replace its simulated value layer."""
from pathlib import Path
import re, base64
root=Path(__file__).resolve().parents[2]
s=(root/'prototype/index.html').read_text()
s=re.sub(r'<link[^>]+https://fonts\.[^>]+>','',s)
s=s.replace('<title>GenkiAI — Agent Harness</title>','<title>Pepe Arcade Scene</title><link rel="stylesheet" href="./fonts.css">')
# Extract the embedded medallion without changing its bytes.
m=re.search(r'data:image/webp;base64,([A-Za-z0-9+/=]+)',s)
(root/'web/public/assets/medallion.webp').write_bytes(base64.b64decode(m[1]))
s=s.replace(m[0],'./assets/medallion.webp')
# Lobby's scene carries its own Ethereum-mainnet MetaMask script and inline music: the shell drives the wallet, and the music is the asset file.
s,n=re.subn(r'<script>\s*/\* =+ MetaMask connect =+.*?</script>\s*','',s,count=1,flags=re.S);assert n==1
s,n=re.subn(r'<script type="text/plain" id="bgmData">[A-Za-z0-9+/=\s]*</script>\s*','',s,count=1);assert n==1
a=s.index("  var raw=document.getElementById('bgmData')");b=s.index("  function fadeTo(",a);s=s[:a]+"  audio.src='assets/bgm.mp3';\n\n"+s[b:]
# The $IMD chip and dropdown row show mainnet $IMD; everywhere else the Sepolia game swaps against ETH.
keep=['<span class="tk">$IMD</span>','<p class="wp-row"><span>$IMD</span>','aria-label="Balance 0 $IMD"']
for i,k in enumerate(keep):assert s.count(k)==1,k;s=s.replace(k,'\0keep%d\0'%i)
s=s.replace('$IMD','Sepolia ETH')
for i,k in enumerate(keep):s=s.replace('\0keep%d\0'%i,k)
def once(old,new):
 global s
 assert s.count(old)==1,old;s=s.replace(old,new)
# The pill drives the Sepolia arcade wallet; the dropdown lists mainnet holdings (read-only).
once('<span class="wp-net" id="wpNet">Ethereum</span>','<span class="wp-net" id="wpNet">Sepolia</span>')
once('<p class="wp-sub">in your wallet</p>','<p class="wp-sub">on Ethereum mainnet</p>')
once('<p class="wp-note">the game still uses play balances for now</p>','<p class="wp-note">the arcade plays on Sepolia for now</p>')
for k in ('wpEth','wpIce','wpImd'):once('<b id="%s">…</b>'%k,'<b id="%s">—</b>'%k)
# On small screens the pill is scaled up from its top-right corner so it is never under 28 CSS px tall.
once("""      f.querySelector('.slide').style.transform='scale('+s+')';
    });
""","""      f.querySelector('.slide').style.transform='scale('+s+')';
    });
    var wal=document.getElementById('wallet');
    if(wal){wal.style.transformOrigin='top right';wal.style.transform='scale('+Math.max(1,28/(34*s))+')';}
""")
def between(start,end,content):
 global s
 a=s.index(start);b=s.index(end,a);s=s[:a]+content+'\n'+s[b:]
between('  var imdShown=0;','  // ---- paying for a pee', '''  var balance=0, docked=true, balDone=true;
  // start docked: logo + headline + chips in the upper left (measured once the font is in)
  (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){
    dockBrand(document.getElementById('balance'),document.getElementById('balAmt'),1000,true);
  });
  function bridge(){return parent.pepe;}
  function live(){return bridge()?bridge().snapshot():{tank:0,free:0,points:0};}
  function showBalance(add){if(add && bridge())bridge().addPoints(add);}
  function setImd(){ /* balances arrive only from the parent chain client */ }
''')
between('  // ---- paying for a pee','  // ================= chapter 2', '''  // Paid tank charges are local; wallet balances only change after chain reads.
  function canPee(){return live().tank>0;}
  function peeBroke(){if(bridge())bridge().message('Tank empty. Fill it with ICE first.');countEl.textContent='0';}
  function payPee(){return bridge() && bridge().consumePee();}
  function brokeShake(){peeBroke();}
  function r6(v){return Math.round(v*1e6)/1e6;}
  function fmtImd(v){return Number(v).toLocaleString(undefined,{maximumFractionDigits:6});}
''')
s=s.replace("g.textContent='+'+ICE.per+' $ICE'","g.textContent='+'+ICE.per+' points'")
s=s.replace('<span class="tk">$ICE</span><span class="lbl">earned</span>', '<span class="tk">points</span><span class="lbl">local prize</span>')
s=s.replace('Balance 1,000 $ICE','Mainnet $ICE balance unavailable').replace('Balance 0 $IMD','Mainnet $IMD balance unavailable')
s=s.replace('<span class="amt" id="balAmt">0</span>','<span class="amt" id="balAmt">—</span>').replace('<span class="amt" id="imdAmt">0</span>','<span class="amt" id="imdAmt">—</span>')
s=s.replace('45 $ICE','45 points').replace('240 $ICE','240 points').replace('1,500 $ICE','1,500 points')
s=s.replace("roll a <b>77</b> and it's all yours", 'roll <b>77</b> · win 90% of both pots').replace('every pee + 1% of each swap → jackpot','tank fills + 1% of each swap → jackpot')
s=s.replace('    payPee();', '    if(!payPee()){cancelDraw();return;}')
# Only the climb ledger uses local points; never credit wallet ICE for play.
a=s.index('  // ================= chapter 3:');b=s.index('  // ================= jackpot swap:')
cl=s[a:b].replace('$ICE','points')
cl=cl.replace("if(balance<CL.BURN){brokeShake();climbFire(false);return false;}\n    showBalance(-CL.BURN);", "if(!bridge() || !bridge().consumeBurst()){climbFire(false);return false;}")
cl=cl.replace('CL.free--;','if(!bridge() || !bridge().consumeBurst())return false; CL.free=live().free;')
s=s[:a]+cl+s[b:]
between('  var JS={','  function enableSwap(){', '''  var JS={on:false,busy:false,dir:'ice',swapped:{}};
  var jpEl=document.getElementById('jpMarquee'), signEl=document.getElementById('swapSign');
  function renderSign(roll){
    if(roll!=null)document.getElementById('ssRoll').textContent=String(roll);
    document.getElementById('ssPee').textContent='1 tank charge';
    document.getElementById('ssDir').textContent=JS.dir==='ice'?'swap 100 ICE → ETH':'swap 0.001 ETH → ICE';
  }
  function flipSwap(){if(JS.busy)return;JS.dir=JS.dir==='ice'?'imd':'ice';if(bridge())bridge().flip(JS.dir==='imd');renderSign();}
  document.getElementById('ssFlip').addEventListener('click',function(e){e.currentTarget.blur();flipSwap();});
''')
between('  function jackpotSwap(){','  function updateSwap(){', '''  function jackpotSwap(){
    if(JS.busy){if(bridge())bridge().message('Still confirming the last move. Try again in a moment.');return;}
    if(!bridge())return;
    bridge().swap(JS.dir==='imd',JS.dir==='ice'?'100':'0.001',false);
    countEl.textContent='…';
    iceEl.classList.add('flash');setTimeout(function(){iceEl.classList.remove('flash');},200);
  }
''')
between('  function autoViable(dir){','  function padLabel(t){', '''  function autoViable(dir){return live().tank>0 && !live().busy;}
''')
s=s.replace("padLabel('out of $ICE + Sepolia ETH')","padLabel('fill the tank')")
between('  // ================= golden throne:', '  function showThrone(){', '''  // Golden throne buys ICE from the game wallet in the background; no wallet prompt.
  var TH={up:false,open:false,busy:false,x:118,BUFF:5,OPTS:[0.001,0.005,0.01]};
  var thEl=document.getElementById('gThrone'), thPanel=document.getElementById('gtPanel'), cueThrone=document.getElementById('cueThrone');
  jitterLetters(cueThrone,57);
  function thRender(){
    [].forEach.call(thPanel.querySelectorAll('.gt-opts button'),function(b){b.disabled=!!live().busy; b.querySelector('small').textContent='instant ICE buy';});
  }
''')
between('  function thBuy(i){', "  [].forEach.call(thPanel.querySelectorAll('.gt-opts button')", '''  function thBuy(i){
    if(!TH.open||TH.busy||!bridge())return;
    bridge().swap(true,String(TH.OPTS[i]),true);
    thMsg('Buying ICE in the background.');
  }
''')
s=s.replace('v4 hook · offer ETH to the porcelain god, get Sepolia ETH · 1 ETH ≈ 497 Sepolia ETH','v4 hook · offer Sepolia ETH, get ICE')
s=s.replace('Golden throne: swap ETH for Sepolia ETH','Golden throne: swap ETH for ICE')
s=re.sub(r'≈ [\d.]+ Sepolia ETH', 'instant ICE buy',s)
s=s.replace('<b>2%</b> house rake','<b>1%</b> to the pot').replace('pays <b>+20%</b>','pays <b>20× fee, pot cap 10%</b>').replace('demo wallet','live wallet').replace('0.050 ETH','— ETH')
s=s.replace('swap <b>100 $ICE</b> → <b>99 Sepolia ETH</b>','swap <b>100 ICE</b> → <b>live ETH quote</b>')
s=s.replace('2,500 $ICE','live pots').replace('1 Sepolia ETH = 89,706 $ICE','live ETH/ICE price')
# Game keyboard handlers must not trap browser shortcuts or editable controls.
s=s.replace("window.addEventListener('keydown',function(e){", "window.addEventListener('keydown',function(e){\n    if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;")
s=s.replace("window.addEventListener('keyup',function(e){", "window.addEventListener('keyup',function(e){\n    if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;")
# Small parent bridge, preserving the existing game world and all controls.
pos=s.index('  // ---- loop ----')
s=s[:pos]+'''  // ---- wallet pill: the shell owns the wallet (parent.pepe.wallet); the scene renders pepeScene.wallet(view) ----
  var WV={wrong:false,busy:false};
  var wBox=document.getElementById('wallet'), wBtn=document.getElementById('walletBtn'), wPop=document.getElementById('walletPop');
  function walletOpen(on){
    wPop.hidden=!on;wBtn.setAttribute('aria-expanded',on?'true':'false');
    if(on&&bridge())bridge().wallet.refresh();
  }
  wBtn.addEventListener('click',function(e){
    e.stopPropagation();wBtn.blur();
    var w=bridge()&&bridge().wallet;
    if(!w||WV.busy)return;
    if(!WV.account)w.connect();else if(WV.wrong)w.switchChain();else walletOpen(wPop.hidden);
  });
  document.getElementById('wpOut').addEventListener('click',function(e){e.stopPropagation();e.currentTarget.blur();walletOpen(false);if(bridge())bridge().wallet.disconnect();});
  wPop.addEventListener('click',function(e){e.stopPropagation();});
  document.addEventListener('click',function(){if(!wPop.hidden)walletOpen(false);});
  window.addEventListener('blur',function(){if(!wPop.hidden)walletOpen(false);});   // a click on the page outside the scene
  window.addEventListener('keydown',function(e){if(e.key==='Escape'&&!wPop.hidden)walletOpen(false);});
  function chipLabel(tk,v){return v==='…'?'Loading mainnet '+tk+' balance':/[0-9]/.test(v)?'Mainnet '+tk+' balance '+v:'Mainnet '+tk+' balance unavailable';}

  var paused=false;
  window.pepeScene={
    wallet:function(v){
      var on=!!v.account, short=on?v.account.slice(0,6)+'…'+v.account.slice(-4):'—', h=v.holdings;
      WV=v;
      wBox.classList.toggle('on',on);wBox.classList.toggle('wrong',on&&v.wrong);wBox.classList.toggle('busy',!!v.busy);
      document.getElementById('walletLbl').textContent=!on?'connect':v.wrong?'switch to '+v.network:short;
      wBtn.setAttribute('aria-label',!on?'Connect wallet':v.wrong?'Wrong network, switch to '+v.network:'Wallet '+short);
      document.getElementById('wpAddr').textContent=short;
      document.getElementById('wpNet').textContent=on&&v.wrong?'wrong network':v.network;
      document.getElementById('wpEth').textContent=h.eth;
      document.getElementById('wpIce').textContent=h.ice;
      document.getElementById('wpImd').textContent=h.imd;
      // the chips show mainnet holdings; Sepolia balances stay in the stats row below the game
      document.getElementById('balAmt').textContent=h.ice;
      document.getElementById('imdAmt').textContent=h.imd;
      document.getElementById('balance').setAttribute('aria-label',chipLabel('$ICE',h.ice));
      document.getElementById('imdBal').setAttribute('aria-label',chipLabel('$IMD',h.imd));
      placeImd();
      var msg=document.getElementById('walletMsg');msg.textContent=v.message||'';msg.classList.toggle('show',!!v.message);
      if(!on)walletOpen(false);
    },
    update:function(state){
      function fmt(v,dec){return v==null?'—':(Number(v)/Math.pow(10,dec||18)).toLocaleString(undefined,{maximumFractionDigits:6});}
      var eth=fmt(state.eth,18);
      document.getElementById('jpAmt').textContent=fmt(state.potIce,state.decimals)+' ICE + '+fmt(state.potEth,18)+' ETH';
      document.getElementById('ssPx').textContent=state.price?'1 ETH = '+state.price.toLocaleString(undefined,{maximumFractionDigits:2})+' ICE':'waiting for pool price';
      document.getElementById('gtWallet').textContent=eth+' ETH';
      JS.busy=state.busy;TH.busy=state.busy;CL.free=state.free;
      var last=state.tickets.find(function(t){return t.roll;});
      if(last){document.getElementById('ssRoll').textContent=String(last.roll);if(JS.on)countEl.textContent=String(last.roll);}
      renderHud();renderSign();thRender();
    },
    control:function(key,down){
      if(paused)return;
      if(!hero.active)wake();
      window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{key:key,code:key===' '?'Space':key,bubbles:true}));
    },
    pause:function(value){paused=value;document.documentElement.classList.toggle('paused',paused);keys.left=keys.right=keys.up=false;if(DRAW.on)cancelDraw();if(CL.on)climbFire(false);}
  };
  if(bridge())window.pepeScene.update(live());
''' +s[pos:]
s=s.replace("var dt=Math.min((now-last)/1000,1/30);last=now;", "var dt=Math.min((now-last)/1000,1/30);last=now;\n    if(paused || document.hidden){requestAnimationFrame(frame);return;}")
s=s.replace('transition:all ', 'transition:opacity ')
s=s.replace('h5','h2').replace('h4','h2')
# Skip SVGs inside CSS data URIs (the greek key ground): a double quote there ends the url() and drops the rule.
s=re.sub(r'(?<!utf8,)<svg(?![^>]*aria-hidden)', '<svg aria-hidden="true"',s)
s=s.replace('role="dialog" aria-label="Golden throne: swap ETH for ICE"','role="region" aria-label="Golden throne: swap ETH for ICE"')
s=s.replace('</style>', '''
.paused *, .paused *::before,.paused *::after{animation-play-state:paused!important;transition:none!important}
</style>''',1)
(root/'web/public/game.html').write_text(s)
