(()=>{'use strict';
const $=id=>document.getElementById(id), canvas=$('canvas'),ctx=canvas.getContext('2d'),W=400,H=600;
const worlds=['Candy Clouds','Sunny Skies','Neon Nights','Jelly Jungle','Frosty Bounce','Lava Leap','Cosmic Chaos','Rainbow Rush','Turbo Trials','Bounce Legend'];
const palettes=[['#ff7ac4','#9d4ae9','#ffd85c'],['#60d8ff','#548bfa','#ffcf54'],['#e16fff','#32277c','#33eac8'],['#78e58a','#178d88','#ffc54e'],['#9befff','#558bd5','#fff'],['#ffae56','#b8396e','#ffeb69'],['#b37dff','#292267','#50f4ef'],['#ff85c4','#49d5ec','#fff071'],['#ffa453','#ec477f','#52eff2'],['#ffd45a','#833cd4','#ffffff']];
const skins=[['Sunny','#ffb63b',0],['Bubblegum','#ff69c3',60],['Minty','#3be5bc',100],['Blueberry','#5aabff',160],['Royal','#b17aff',230],['Golden','#ffe052',350],['Midnight','#414c99',450],['Fireball','#ff6256',600]];
let data;try{data=JSON.parse(localStorage.getItem('aj_bounce_blitz_v1'))||{unlocked:1,stars:{},coins:0,skin:0,owned:[0],sound:true}}catch{data={unlocked:1,stars:{},coins:0,skin:0,owned:[0],sound:true}};
data.unlocked=Math.max(1,Math.min(100,data.unlocked||1));data.stars=data.stars||{};data.owned=data.owned||[0];data.coins=Number(data.coins)||0;
const save=()=>{try{localStorage.setItem('aj_bounce_blitz_v1',JSON.stringify(data))}catch{}};
let scene='home',level=1,game=null,keys={left:false,right:false},last=0,raf=0,audio=null;
// Locally bundled original arcade music and sound effects; no network or advertising.
const music={menu:new Audio('audio/music_menu.wav'),game:new Audio('audio/music_game.wav')};
Object.values(music).forEach(a=>{a.loop=true;a.volume=.26;a.preload='auto'});
const effects={jump:'audio/jump.wav',coin:'audio/coin.wav',win:'audio/win.wav',lose:'audio/lose.wav',click:'audio/click.wav',buy:'audio/buy.wav'};
let musicUnlocked=false,lastJumpSfx=0;
function playEffect(name){if(!data.sound)return;const file=effects[name];if(!file)return;try{const a=new Audio(file);a.volume=name==='jump'?.22:.48;a.play().catch(()=>{})}catch{}}
function syncMusic(){const target=scene==='game'?'game':'menu';for(const [key,a] of Object.entries(music)){if(key!==target||!data.sound){a.pause();a.currentTime=0}else if(musicUnlocked){a.play().catch(()=>{})}}}
function unlockMusic(){musicUnlocked=true;syncMusic()}
document.addEventListener('pointerdown',unlockMusic,{capture:true});
document.addEventListener('keydown',unlockMusic,{capture:true});

function sound(freq=520,dur=.09,type='sine'){if(!data.sound)return;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.09,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+dur)}catch{}}
function screen(name){scene=name;document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id===name));keys.left=keys.right=false;if(name==='home')$('homeStat').textContent=`🏆 ${data.unlocked-1}/100 levels cleared   🟡 ${data.coins} coins`;if(name==='levels')drawLevels();if(name==='shop')drawShop();syncMusic()}
function rng(seed){let x=seed>>>0;return()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296}}
function build(n){
 const r=rng(n*7817+33),tier=Math.floor((n-1)/10);
 const count=5+Math.min(7,Math.floor(n/12)),gap=68+Math.min(9,Math.floor(tier/2));
 const plats=[];let side=0;
 for(let i=0;i<count;i++){
   // Alternating landing zones prevent idle vertical bouncing from clearing levels.
   // Each jump requires deliberate left/right steering; horizontal travel remains reachable.
   const width=i===0?138:Math.max(98,128-tier*2-Math.floor(r()*10));
   if(i>0 && r()<.17 && i>2) side=1-side; else if(i>0) side=1-side;
   const x=i===0?32:side===0?25+Math.floor(r()*24):W-width-25-Math.floor(r()*24);
   const y=H-76-i*gap;
   plats.push({x,y,w:width,h:16,moving:i>2&&n>20&&i%5===0,baseX:x,phase:r()*6.28,crumble:i>2&&n>30&&i%5===1,touch:0,dead:false});
 }
 const stars=plats.slice(1).map((p,i)=>({x:p.x+p.w/2,y:p.y-32,taken:false,value:i%3===0?3:1}));
 const hazards=plats.slice(2,-1).filter((p,i)=>n>5&&i%Math.max(3,6-Math.floor(tier/3))===0).map(p=>({x:p.x+p.w*.80,y:p.y-12,r:9,phase:r()*6.28}));
 return{plats,stars,hazards,goal:{x:plats.at(-1).x+plats.at(-1).w/2,y:plats.at(-1).y-34},height:count*gap+100,tier,theme:palettes[tier],maxStars:stars.reduce((a,b)=>a+b.value,0)};
}
function start(n){level=n;const map=build(n);game={map,player:{x:map.plats[0].x+map.plats[0].w/2,y:map.plats[0].y-18,vx:0,vy:-10.8,r:15},camera:0,elapsed:0,score:0,dead:false,done:false,paused:false,earned:0,attempts:0};$('levelInfo').textContent=`LEVEL ${n} · ${worlds[Math.floor((n-1)/10)]}`;$('coinInfo').textContent=`⭐ 0/${map.maxStars}`;$('overlay').classList.add('hidden');screen('game');last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop)}
function overlay(title,msg,main,primary,alt,secondary){$('overlayTitle').textContent=title;$('overlayText').textContent=msg;$('overlayMain').textContent=main;$('overlayMain').onclick=primary;$('overlayAlt').textContent=alt||'';$('overlayAlt').style.display=alt?'block':'none';$('overlayAlt').onclick=secondary||(()=>{});$('overlay').classList.remove('hidden')}
function fail(){if(game.dead||game.done)return;game.dead=true;playEffect('lose');overlay('💥 OOPS!','One more try! You can do it.','↻ TRY AGAIN',()=>start(level),'LEVELS',()=>screen('levels'))}
function win(){if(game.done)return;game.done=true;playEffect('win');const ratio=game.score/game.map.maxStars,stars=ratio>=.85?3:ratio>=.45?2:1,previous=data.stars[level]||0;data.stars[level]=Math.max(previous,stars);data.unlocked=Math.max(data.unlocked,Math.min(100,level+1));const earned=5+game.score*2+(stars>previous?stars*5:0);data.coins+=earned;save();overlay('🎉 LEVEL CLEARED!',`${'⭐'.repeat(stars)} · +${earned} coins · ${Math.round(ratio*100)}% stars collected`,level<100?'NEXT LEVEL ▶':'🏆 ALL 100 DONE!',()=>level<100?start(level+1):screen('levels'),'REPLAY',()=>start(level))}
function update(dt){const g=game,p=g.player,m=g.map;g.elapsed+=dt;const f=Math.min(1.6,dt*60);const acceleration=.65,maxSpeed=5.5+Math.min(.55,m.tier*.06);if(keys.left)p.vx=Math.max(-maxSpeed,p.vx-acceleration*f);else if(keys.right)p.vx=Math.min(maxSpeed,p.vx+acceleration*f);else p.vx*=Math.pow(.77,f);const prevY=p.y;p.x+=p.vx*f;p.vy=Math.min(12,p.vy+.62*f);p.y+=p.vy*f;p.x=Math.max(p.r,Math.min(W-p.r,p.x));for(const plat of m.plats){if(plat.moving)plat.x=Math.max(14,Math.min(W-plat.w-14,plat.baseX+Math.sin(g.elapsed*1.0+plat.phase)*15));if(plat.dead)continue;if(p.vy>=0&&prevY+p.r<=plat.y+8&&p.y+p.r>=plat.y&&p.x+p.r>plat.x+6&&p.x-p.r<plat.x+plat.w-6){p.y=plat.y-p.r;p.vy=-Math.max(10.8,11.4-m.tier*.025);if(g.elapsed-lastJumpSfx>.1){playEffect('jump');lastJumpSfx=g.elapsed}if(plat.crumble&&!plat.touch)plat.touch=g.elapsed}if(plat.crumble&&plat.touch&&g.elapsed-plat.touch>.52)plat.dead=true}for(const s of m.stars){if(!s.taken&&Math.hypot(p.x-s.x,p.y-s.y)<p.r+13){s.taken=true;g.score+=s.value;$('coinInfo').textContent=`⭐ ${g.score}/${m.maxStars}`;playEffect('coin')}}for(const h of m.hazards){const hx=h.x+Math.sin(g.elapsed*2.5+h.phase)*12;if(Math.hypot(p.x-hx,p.y-h.y)<p.r+h.r-3){fail();return}}if(Math.hypot(p.x-m.goal.x,p.y-m.goal.y)<30){win();return}if(p.y>H+g.camera+90){fail();return}const desired=Math.max(0,H*.52-p.y);g.camera+=(desired-g.camera)*Math.min(1,dt*5)}
function roundRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
// Parallax promotional decor is drawn BEHIND gameplay, never over the ball or platforms.
function drawBrandDecor(camera,t,m){
 ctx.save();
 const offset=(camera*.16)%420;
 for(let j=-1;j<3;j++){
   const y=82+j*420+offset;
   const left=j%2===0;
   const bx=left?10:W-164;
   // Floating company banners: readable but translucent enough for gameplay.
   ctx.save();ctx.globalAlpha=.55;
   roundRect(bx,y,154,48,12,'#171238');
   ctx.strokeStyle='#ffe477';ctx.lineWidth=2;ctx.strokeRect(bx+4,y+4,146,40);
   ctx.textAlign='center';ctx.fillStyle='#ffe477';ctx.font='bold 13px system-ui';
   ctx.fillText('AL JEFOON',bx+77,y+21);
   ctx.fillStyle='#fff';ctx.font='bold 10px system-ui';ctx.fillText('TENTS',bx+77,y+35);
   ctx.restore();
   for(let k=0;k<3;k++){
     const x=left?192+k*25:20+k*27;
     const by=y+8+Math.sin(t*1.2+j+k)*7;
     ctx.save();ctx.globalAlpha=.58;
     ctx.strokeStyle='#fff9';ctx.lineWidth=1;
     ctx.beginPath();ctx.moveTo(x,by+14);ctx.quadraticCurveTo(x+7,by+32,x-1,by+51);ctx.stroke();
     ctx.fillStyle=['#ffe65c','#ff7fc4','#72edff'][k];
     ctx.beginPath();ctx.ellipse(x,by,10,14,Math.sin(t+j)*.1,0,Math.PI*2);ctx.fill();
     ctx.restore();
   }
 }
 ctx.restore();
}

function draw(){if(!game)return;const g=game,m=g.map,c=g.camera,t=g.elapsed;const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,m.theme[1]);bg.addColorStop(1,m.theme[0]);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);ctx.save();ctx.globalAlpha=.19;for(let i=0;i<30;i++){const x=(i*89+level*47)%W,y=(i*157+Math.floor(c*.2))%H;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,3+(i%5)*3,0,Math.PI*2);ctx.fill()}ctx.restore();drawBrandDecor(c,t,m);ctx.save();ctx.translate(0,c);for(const p of m.plats){if(p.dead)continue;roundRect(p.x,p.y,p.w,17,8,p.crumble?'#f8a9c8':'#fff');roundRect(p.x+4,p.y+4,p.w-8,9,5,p.crumble?'#eb5c91':m.theme[2]);roundRect(p.x+9,p.y+17,p.w-18,5,3,'#0002')}for(const s of m.stars){if(s.taken)continue;ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.sin(t*2+s.x)*.18);ctx.fillStyle='#ffe65a';ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?6:13;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.restore()}for(const h of m.hazards){const x=h.x+Math.sin(t*2.5+h.phase)*12;ctx.fillStyle='#ff4b72';ctx.beginPath();for(let i=0;i<12;i++){const a=i*Math.PI/6+t*.9,r=i%2?9:17;ctx.lineTo(x+Math.cos(a)*r,h.y+Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-3,h.y-2,2,0,7);ctx.arc(x+4,h.y-2,2,0,7);ctx.fill()}const goal=m.goal;ctx.save();ctx.translate(goal.x,goal.y);ctx.strokeStyle='#ffe86d';ctx.lineWidth=6;ctx.shadowBlur=18;ctx.shadowColor='#fff2a0';ctx.beginPath();ctx.ellipse(0,0,21,28,0,0,7);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText('GO!',0,4);ctx.restore();const p=g.player;ctx.fillStyle=skins[data.skin][1];ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();ctx.fillStyle='#ffffff66';ctx.beginPath();ctx.arc(p.x-5,p.y-6,5,0,7);ctx.fill();ctx.fillStyle='#322247';ctx.beginPath();ctx.arc(p.x-5,p.y-1,2.2,0,7);ctx.arc(p.x+5,p.y-1,2.2,0,7);ctx.fill();ctx.strokeStyle='#322247';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y+2,5,.1,Math.PI-.1);ctx.stroke();ctx.restore();ctx.fillStyle='#ffffffb5';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText('AL JEFOON TENTS',W/2,H-13)}
function loop(now){if(scene!=='game'||!game)return;const dt=Math.min(.034,(now-last)/1000||.016);last=now;if(!game.dead&&!game.done&&!game.paused)update(dt);draw();raf=requestAnimationFrame(loop)}
function drawLevels(){const grid=$('levelGrid');grid.replaceChildren();$('worldLabel').textContent=`Unlocked ${data.unlocked}/100 · 🟡 ${data.coins} coins`;for(let n=1;n<=100;n++){const b=document.createElement('button');const locked=n>data.unlocked;b.className=locked?'locked':data.stars[n]?'completed':'';b.textContent=locked?'🔒':`${n}${data.stars[n]?'★':''}`;b.title=`${worlds[Math.floor((n-1)/10)]} · Level ${n}`;b.disabled=locked;b.onclick=()=>start(n);grid.append(b)}}
function drawShop(){const box=$('skins');box.replaceChildren();$('wallet').textContent=`🟡 Your coins: ${data.coins}`;skins.forEach(([name,color,cost],i)=>{const d=document.createElement('div');d.className='skin';const orb=document.createElement('div');orb.className='ball';orb.style.background=color;const title=document.createElement('strong');title.textContent=name;const b=document.createElement('button');const owned=data.owned.includes(i);b.textContent=data.skin===i?'✓ EQUIPPED':owned?'EQUIP':`🟡 ${cost}`;b.onclick=()=>{if(owned){data.skin=i;sound(580)}else if(data.coins>=cost){data.coins-=cost;data.owned.push(i);data.skin=i;sound(880)}else{sound(130,.15);return}playEffect('buy');save();drawShop()};d.append(orb,title,b);box.append(d)})}
$('play').onclick=()=>start(data.unlocked);$('levelsBtn').onclick=()=>screen('levels');$('shopBtn').onclick=()=>screen('shop');$('howBtn').onclick=()=>screen('how');document.querySelectorAll('.back').forEach(b=>b.onclick=()=>screen('home'));$('overlayMenu').onclick=()=>screen('home');$('sound').onclick=()=>{data.sound=!data.sound;$('sound').textContent=data.sound?'🔊':'🔇';save();syncMusic()};$('sound').textContent=data.sound?'🔊':'🔇';$('pause').onclick=()=>{if(!game||game.dead||game.done)return;game.paused=!game.paused;if(game.paused)overlay('⏸ PAUSED','Ready for another bounce?','▶ RESUME',()=>{game.paused=false;$('overlay').classList.add('hidden')},'RESTART',()=>start(level));else $('overlay').classList.add('hidden')};
function bindHold(id,dir){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);keys[dir]=true});for(const evt of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(evt,()=>keys[dir]=false)}bindHold('left','left');bindHold('right','right');
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Space','KeyA','KeyD'].includes(e.code))e.preventDefault();if(e.code==='ArrowLeft'||e.code==='KeyA')keys.left=true;if(e.code==='ArrowRight'||e.code==='KeyD')keys.right=true;if(e.code==='Space'&&scene==='game'&&!e.repeat)$('pause').click()});window.addEventListener('keyup',e=>{if(e.code==='ArrowLeft'||e.code==='KeyA')keys.left=false;if(e.code==='ArrowRight'||e.code==='KeyD')keys.right=false});window.addEventListener('blur',()=>{keys.left=keys.right=false;if(scene==='game'&&game&&!game.dead&&!game.done&&!game.paused)$('pause').click()});
// Touch-drag on the canvas also steers the ball, making one-thumb play possible.
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);steer(e)});canvas.addEventListener('pointermove',e=>{if(e.buttons)steer(e)});canvas.addEventListener('pointerup',()=>keys.left=keys.right=false);canvas.addEventListener('pointercancel',()=>keys.left=keys.right=false);function steer(e){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W;keys.left=x<W*.45;keys.right=x>W*.55}
screen('home');})();
