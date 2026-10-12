(()=>{'use strict';
const $=id=>document.getElementById(id), canvas=$('canvas'),ctx=canvas.getContext('2d'),W=400,H=600;
const worlds=['Candy Clouds','Sunny Skies','Neon Nights','Jelly Jungle','Frosty Bounce','Lava Leap','Cosmic Chaos','Rainbow Rush','Turbo Trials','Bounce Legend'];
const palettes=[['#ff7ac4','#9d4ae9','#ffd85c'],['#60d8ff','#548bfa','#ffcf54'],['#e16fff','#32277c','#33eac8'],['#78e58a','#178d88','#ffc54e'],['#9befff','#558bd5','#fff'],['#ffae56','#b8396e','#ffeb69'],['#b37dff','#292267','#50f4ef'],['#ff85c4','#49d5ec','#fff071'],['#ffa453','#ec477f','#52eff2'],['#ffd45a','#833cd4','#ffffff']];
const skins=[['Sunny','#ffb63b',0],['Bubblegum','#ff69c3',60],['Minty','#3be5bc',100],['Blueberry','#5aabff',160],['Royal','#b17aff',230],['Golden','#ffe052',350],['Midnight','#414c99',450],['Fireball','#ff6256',600]];
let data;try{data=JSON.parse(localStorage.getItem('aj_bounce_blitz_v1'))||{unlocked:1,stars:{},coins:0,skin:0,owned:[0],sound:true}}catch{data={unlocked:1,stars:{},coins:0,skin:0,owned:[0],sound:true}};
data.unlocked=Math.max(1,Math.min(100,data.unlocked||1));data.stars=data.stars||{};data.owned=data.owned||[0];data.coins=Number(data.coins)||0;
const save=()=>{try{localStorage.setItem('aj_bounce_blitz_v1',JSON.stringify(data))}catch{}};
let scene='home',level=1,game=null,keys={left:false,right:false},last=0,raf=0,audio=null,joystickAxis=0;
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
function screen(name){scene=name;document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id===name));keys.left=keys.right=false;joystickAxis=0;resetJoystick();if(name==='home')$('homeStat').textContent=`🏆 ${data.unlocked-1}/100 levels cleared   🟡 ${data.coins} coins`;if(name==='levels')drawLevels();if(name==='shop')drawShop();syncMusic()}
function rng(seed){let x=seed>>>0;return()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296}}
function build(n){
 const r=rng(n*7817+33),tier=Math.floor((n-1)/10);
 const count=6+Math.min(7,Math.floor((n-1)/12));
 // Ten layout families, with level-specific seeded variations in widths, gaps and positions.
 // Vertical gaps stay within the manual jump's reachable height.
 const family=(n-1)%10,plats=[];
 let prevCenter=101,prevY=H-76;
 for(let i=0;i<count;i++){
   const width=i===0?138:Math.max(100,142-tier*2-Math.floor(r()*22));
   let center;
   if(i===0)center=100;
   else {
     const k=i+Math.floor((n-1)/10);
     switch(family){
       case 0: center=k%2?W-104:104;break; // zigzag
       case 1: center=90+((k*43)%220);break; // rising staircase
       case 2: center=200+Math.sin(k*1.16)*105;break; // wave
       case 3: center=(k%3===0?W-95:k%3===1?200:95);break; // triple lane
       case 4: center=200+Math.sin(k*2.1)*90;break; // serpentine
       case 5: center=k%4<2?100:300;break; // paired ledges
       case 6: center=120+((k*71)%165);break; // staggered
       case 7: center=k%2?260:140;break; // close zigzag
       case 8: center=200+Math.cos(k*.85)*96;break; // looping arc
       default:center=85+((k*97)%230); // scramble
     }
     center+=Math.floor((r()-.5)*24);
     // Limit horizontal jumps so every stage remains reachable at current joystick speed.
     center=Math.max(prevCenter-154,Math.min(prevCenter+154,center));
   }
   center=Math.max(width/2+18,Math.min(W-width/2-18,center));
   const x=Math.round(center-width/2);
   const gap=i===0?0:58+Math.floor(r()*15)+Math.min(4,tier);
   const y=i===0?prevY:prevY-gap;
   const moving=n>=21&&i>=3&&i<count-1&&((i+family)%4===0||n>=61&&i%3===0);
   const amplitude=moving?Math.min(18,8+tier+Math.floor(r()*5)):0;
   plats.push({x,y,w:width,h:16,moving,baseX:x,phase:r()*6.28,amplitude,
     crumble:n>=35&&i>2&&(i+family)%6===0,touch:0,dead:false});
   prevCenter=center;prevY=y;
 }
 const stars=plats.slice(1).map((p,i)=>({x:p.x+p.w/2,y:p.y-33,taken:false,value:i%3===0?3:1}));
 const hazards=[];
 for(let i=2;i<plats.length-1;i++){
   const p=plats[i];
   if(n<=5||(i+family)%Math.max(3,6-Math.floor(tier/3))!==0)continue;
   // Never put enemies over stars, near the landing center, or at the platform edge.
   const hazardX=p.x+p.w*.77,star=stars[i-1];
   if(star)star.x=p.x+p.w*.22;
   if(star&&Math.hypot(hazardX-star.x,(p.y-12)-star.y)<48)continue;
   hazards.push({x:hazardX,y:p.y-12,r:8,phase:r()*6.28});
 }
 return{plats,stars,hazards,goal:{x:plats.at(-1).x+plats.at(-1).w/2,y:plats.at(-1).y-34},height:count*76+100,tier,theme:palettes[tier],maxStars:stars.reduce((a,b)=>a+b.value,0)};
}
function start(n){level=n;const map=build(n);game={map,player:{x:map.plats[0].x+map.plats[0].w/2,y:map.plats[0].y-18,vx:0,vy:0,r:15,grounded:true},camera:0,elapsed:0,boostReady:true,coyote:0,jumpBuffer:0,bounceCooldown:0,score:0,dead:false,done:false,paused:false,earned:0,attempts:0};$('levelInfo').textContent=`LEVEL ${n} · ${worlds[Math.floor((n-1)/10)]}`;$('coinInfo').textContent=`⭐ 0/${map.maxStars}`;$('overlay').classList.add('hidden');screen('game');last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop)}
function overlay(title,msg,main,primary,alt,secondary){$('overlayTitle').textContent=title;$('overlayText').textContent=msg;$('overlayMain').textContent=main;$('overlayMain').onclick=primary;$('overlayAlt').textContent=alt||'';$('overlayAlt').style.display=alt?'block':'none';$('overlayAlt').onclick=secondary||(()=>{});$('overlay').classList.remove('hidden')}
function fail(){if(game.dead||game.done)return;game.dead=true;playEffect('lose');overlay('💥 OOPS!','One more try! You can do it.','↻ TRY AGAIN',()=>start(level),'LEVELS',()=>screen('levels'))}
function win(){if(game.done)return;game.done=true;playEffect('win');const ratio=game.score/game.map.maxStars,stars=ratio>=.85?3:ratio>=.45?2:1,previous=data.stars[level]||0;data.stars[level]=Math.max(previous,stars);data.unlocked=Math.max(data.unlocked,Math.min(100,level+1));const earned=5+game.score*2+(stars>previous?stars*5:0);data.coins+=earned;save();overlay('🎉 LEVEL CLEARED!',`${'⭐'.repeat(stars)} · +${earned} coins · ${Math.round(ratio*100)}% stars collected`,level<100?'NEXT LEVEL ▶':'🏆 ALL 100 DONE!',()=>level<100?start(level+1):screen('levels'),'REPLAY',()=>start(level))}
function update(dt){const g=game,p=g.player,m=g.map;g.elapsed+=dt;const f=Math.min(1.6,dt*60);
// Restored responsive left/right joystick, with lower top speed and no landing lock.
const axis=joystickAxis || (keys.right?1:0)-(keys.left?1:0);
const speed=p.grounded?2.0:3.35;
p.vx=axis*speed; // no drift on release; movement works immediately after landing
// Forgiving jumping: early jump presses are buffered, and a short coyote window
// allows jumping just after walking off a ledge.
g.coyote=p.grounded?.115:Math.max(0,(g.coyote||0)-dt);
g.jumpBuffer=Math.max(0,(g.jumpBuffer||0)-dt);
g.bounceCooldown=Math.max(0,(g.bounceCooldown||0)-dt);
if(g.jumpBuffer>0&&(p.grounded||g.coyote>0)){
 p.vy=-14.5;p.grounded=false;g.coyote=0;g.jumpBuffer=0;g.bounceCooldown=.22;playEffect('jump');
}
const prevY=p.y;const wasGrounded=p.grounded;p.grounded=false;p.x+=p.vx*f;p.vy=Math.min(12,p.vy+.62*f);p.y+=p.vy*f;p.x=Math.max(p.r,Math.min(W-p.r,p.x));for(const plat of m.plats){if(plat.moving)plat.x=Math.max(14,Math.min(W-plat.w-14,plat.baseX+Math.sin(g.elapsed*(.65+Math.min(.4,level/180))+plat.phase)*(plat.amplitude||12)));if(plat.moving){const idx=m.plats.indexOf(plat);const st=m.stars[idx-1];if(st&&!st.taken)st.x=plat.x+plat.w*(m.hazards.some(h=>Math.abs(h.y-(plat.y-12))<1)?.22:.5);if(idx===m.plats.length-1)m.goal.x=plat.x+plat.w/2;const h=m.hazards.find(h=>Math.abs(h.y-(plat.y-12))<1);if(h)h.x=plat.x+plat.w*.77;}if(plat.dead)continue;if(p.vy>=0&&prevY+p.r<=plat.y+8&&p.y+p.r>=plat.y&&p.x+p.r>plat.x+6&&p.x-p.r<plat.x+plat.w-6){p.y=plat.y-p.r;p.vy=0;p.grounded=true;p.vx=0;g.boostReady=true;
// Gentle landing bounce, far below the height of the next platform.
// It adds character without automatically completing levels.
if(!wasGrounded&&g.bounceCooldown<=0){p.vy=-3.2;p.grounded=false;g.bounceCooldown=.28;}
if(plat.crumble&&!plat.touch)plat.touch=g.elapsed}if(plat.crumble&&plat.touch&&g.elapsed-plat.touch>.52)plat.dead=true}for(const s of m.stars){if(!s.taken&&Math.hypot(p.x-s.x,p.y-s.y)<p.r+13){s.taken=true;g.score+=s.value;$('coinInfo').textContent=`⭐ ${g.score}/${m.maxStars}`;playEffect('coin')}}for(const h of m.hazards){const hx=h.x+Math.sin(g.elapsed*2.5+h.phase)*2;if(Math.hypot(p.x-hx,p.y-h.y)<p.r+h.r-3){fail();return}}if(Math.hypot(p.x-m.goal.x,p.y-m.goal.y)<30){win();return}if(p.y>H+g.camera+90){fail();return}const desired=Math.max(0,H*.52-p.y);g.camera+=(desired-g.camera)*Math.min(1,dt*1.25)}
function roundRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
// Parallax promotional decor is drawn BEHIND gameplay, never over the ball or platforms.
// Decorative parallax layer: branded banners and furniture travel across the screen.
// All elements stay behind the playable platforms and hazards.
function drawBrandDecor(camera,t,m){
 ctx.save();
 const furniture=['chair','round','rect','tent','chair','round','rect'];
 function object(x,y,type,size,hue){
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.lineWidth=3;ctx.lineJoin='round';ctx.strokeStyle='#252050';
  if(type==='chair'){
   ctx.fillStyle=hue;roundRect(-12,-22,24,25,5,hue);ctx.strokeRect(-10,-20,20,21);
   roundRect(-17,2,34,9,3,'#ffe48b');ctx.beginPath();ctx.moveTo(-12,11);ctx.lineTo(-14,28);ctx.moveTo(12,11);ctx.lineTo(14,28);ctx.stroke();
  }else if(type==='round'){
   ctx.fillStyle=hue;ctx.beginPath();ctx.ellipse(0,-7,25,10,0,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.beginPath();ctx.moveTo(0,3);ctx.lineTo(0,23);ctx.moveTo(-14,23);ctx.lineTo(14,23);ctx.stroke();
  }else if(type==='rect'){
   roundRect(-28,-14,56,16,4,hue);ctx.strokeRect(-26,-12,52,13);ctx.beginPath();ctx.moveTo(-20,2);ctx.lineTo(-20,23);ctx.moveTo(20,2);ctx.lineTo(20,23);ctx.stroke();
  }else{
   ctx.fillStyle=hue;ctx.beginPath();ctx.moveTo(-30,1);ctx.lineTo(0,-28);ctx.lineTo(30,1);ctx.closePath();ctx.fill();ctx.stroke();
   ctx.fillStyle='#fff1bb';ctx.fillRect(-23,2,46,24);ctx.strokeRect(-23,2,46,24);ctx.fillStyle='#7c50bd';ctx.fillRect(-5,10,10,16);
  }
  ctx.restore();
 }
 // Alternating moving banners, with high contrast black background and #fcc224 type.
 for(let i=0;i<3;i++){
  const speed=26+i*9;
  const bx=((i%2===0 ? t*speed : -t*speed)+i*187)%(W+240);
  const x=i%2===0?bx-240:W-bx;
  const y=90+i*186+Math.sin(t*1.15+i)*9;
  ctx.save();ctx.globalAlpha=.83;ctx.translate(x,y);ctx.rotate(Math.sin(t*.7+i)*.045);
  roundRect(0,0,218,48,9,'#050505');ctx.strokeStyle='#fcc224';ctx.lineWidth=2;ctx.strokeRect(3,3,212,42);
  ctx.fillStyle='#fcc224';ctx.font='900 17px system-ui';ctx.textAlign='center';ctx.fillText('AL JEFOON TENTS',109,30);
  ctx.restore();
 }
 // Flying furniture: chairs, rectangular tables, round tables, and small tents.
 const colors=['#ffb2dd','#72efff','#ffe38c','#c2ff91','#c9a1ff'];
 for(let i=0;i<14;i++){
  const direction=i%2?1:-1,rate=11+(i%5)*5;
  const travel=((t*rate+i*79)%(W+130));
  const x=direction>0?travel-65:W+65-travel;
  const y=38+(i*97)%525+Math.sin(t*.9+i*2)*13;
  ctx.save();ctx.globalAlpha=.26;object(x,y,furniture[i%furniture.length],.68+(i%3)*.14,colors[i%colors.length]);ctx.restore();
 }
 // Bright balloons float upwards behind the platforms.
 for(let i=0;i<10;i++){
  const x=24+(i*79)%360+Math.sin(t*.55+i)*9;
  const y=((i*81-t*(13+i%3*5))%(H+80)+(H+80))%(H+80)-40;
  ctx.save();ctx.globalAlpha=.45;ctx.strokeStyle='#fff9';ctx.beginPath();ctx.moveTo(x,y+12);ctx.quadraticCurveTo(x+6,y+23,x,y+36);ctx.stroke();
  ctx.fillStyle=colors[i%colors.length];ctx.beginPath();ctx.ellipse(x,y,9,13,0,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 ctx.restore();
}

function draw(){if(!game)return;const g=game,m=g.map,c=g.camera,t=g.elapsed;const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,m.theme[1]);bg.addColorStop(1,m.theme[0]);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);ctx.save();ctx.globalAlpha=.19;for(let i=0;i<30;i++){const x=(i*89+level*47)%W,y=(i*157+Math.floor(c*.2))%H;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,3+(i%5)*3,0,Math.PI*2);ctx.fill()}ctx.restore();drawBrandDecor(c,t,m);ctx.save();ctx.translate(0,Math.round(c));for(const p of m.plats){if(p.dead)continue;roundRect(p.x,p.y,p.w,17,8,p.crumble?'#f8a9c8':'#fff');roundRect(p.x+4,p.y+4,p.w-8,9,5,p.crumble?'#eb5c91':m.theme[2]);roundRect(p.x+9,p.y+17,p.w-18,5,3,'#0002')}for(const s of m.stars){if(s.taken)continue;ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.sin(t*2+s.x)*.18);ctx.fillStyle='#ffe65a';ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?6:13;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.restore()}for(const h of m.hazards){const x=h.x+Math.sin(t*2.5+h.phase)*2;ctx.fillStyle='#ff4b72';ctx.beginPath();for(let i=0;i<12;i++){const a=i*Math.PI/6+t*.9,r=i%2?9:17;ctx.lineTo(x+Math.cos(a)*r,h.y+Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-3,h.y-2,2,0,7);ctx.arc(x+4,h.y-2,2,0,7);ctx.fill()}const goal=m.goal;ctx.save();ctx.translate(goal.x,goal.y);ctx.strokeStyle='#ffe86d';ctx.lineWidth=6;ctx.shadowBlur=18;ctx.shadowColor='#fff2a0';ctx.beginPath();ctx.ellipse(0,0,21,28,0,0,7);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText('GO!',0,4);ctx.restore();const p=g.player;ctx.fillStyle=skins[data.skin][1];ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();ctx.fillStyle='#ffffff66';ctx.beginPath();ctx.arc(p.x-5,p.y-6,5,0,7);ctx.fill();ctx.fillStyle='#322247';ctx.beginPath();ctx.arc(p.x-5,p.y-1,2.2,0,7);ctx.arc(p.x+5,p.y-1,2.2,0,7);ctx.fill();ctx.strokeStyle='#322247';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y+2,5,.1,Math.PI-.1);ctx.stroke();ctx.restore();ctx.fillStyle='#ffffffb5';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText('BOUNCE BLITZ',W/2,H-13)}
function loop(now){if(scene!=='game'||!game)return;const dt=Math.min(.034,(now-last)/1000||.016);last=now;if(!game.dead&&!game.done&&!game.paused)update(dt);draw();raf=requestAnimationFrame(loop)}
function drawLevels(){const grid=$('levelGrid');grid.replaceChildren();$('worldLabel').textContent=`Unlocked ${data.unlocked}/100 · 🟡 ${data.coins} coins`;for(let n=1;n<=100;n++){const b=document.createElement('button');const locked=n>data.unlocked;b.className=locked?'locked':data.stars[n]?'completed':'';b.textContent=locked?'🔒':`${n}${data.stars[n]?'★':''}`;b.title=`${worlds[Math.floor((n-1)/10)]} · Level ${n}`;b.disabled=locked;b.onclick=()=>start(n);grid.append(b)}}
function drawShop(){const box=$('skins');box.replaceChildren();$('wallet').textContent=`🟡 Your coins: ${data.coins}`;skins.forEach(([name,color,cost],i)=>{const d=document.createElement('div');d.className='skin';const orb=document.createElement('div');orb.className='ball';orb.style.background=color;const title=document.createElement('strong');title.textContent=name;const b=document.createElement('button');const owned=data.owned.includes(i);b.textContent=data.skin===i?'✓ EQUIPPED':owned?'EQUIP':`🟡 ${cost}`;b.onclick=()=>{if(owned){data.skin=i;sound(580)}else if(data.coins>=cost){data.coins-=cost;data.owned.push(i);data.skin=i;sound(880)}else{sound(130,.15);return}playEffect('buy');save();drawShop()};d.append(orb,title,b);box.append(d)})}
$('play').onclick=()=>start(data.unlocked);$('levelsBtn').onclick=()=>screen('levels');$('shopBtn').onclick=()=>screen('shop');$('howBtn').onclick=()=>screen('how');document.querySelectorAll('.back').forEach(b=>b.onclick=()=>screen('home'));$('overlayMenu').onclick=()=>screen('home');$('sound').onclick=()=>{data.sound=!data.sound;$('sound').textContent=data.sound?'🔊':'🔇';save();syncMusic()};$('sound').textContent=data.sound?'🔊':'🔇';$('pause').onclick=()=>{if(!game||game.dead||game.done)return;game.paused=!game.paused;if(game.paused)overlay('⏸ PAUSED','Ready for another bounce?','▶ RESUME',()=>{game.paused=false;$('overlay').classList.add('hidden')},'RESTART',()=>start(level));else $('overlay').classList.add('hidden')};
function resetJoystick(){const knob=$('joystickKnob');if(knob)knob.style.transform='translateX(0px)'}
const joystick=$('joystick');let stickPointer=null;
function moveStick(e){const r=joystick.getBoundingClientRect(),center=r.left+r.width/2;
 const dx=Math.max(-1,Math.min(1,(e.clientX-center)/(r.width*.36)));
 joystickAxis=Math.abs(dx)<.10?0:dx;$('joystickKnob').style.transform=`translateX(${Math.round(dx*21)}px)`;
}
joystick.addEventListener('pointerdown',e=>{e.preventDefault();stickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e)});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)moveStick(e)});
function releaseStick(e){if(stickPointer!==null&&e.pointerId!==stickPointer)return;stickPointer=null;joystickAxis=0;resetJoystick()}
for(const evt of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(evt,releaseStick);
function jumpBoost(){if(scene!=='game'||!game||game.dead||game.done||game.paused)return;
 game.jumpBuffer=.16; // press slightly before landing or just after leaving a ledge
 const b=$('jump');b.classList.add('pressed');setTimeout(()=>b.classList.remove('pressed'),120);
}
$('jump').addEventListener('pointerdown',e=>{e.preventDefault();jumpBoost()});
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Space','Escape','KeyA','KeyD'].includes(e.code))e.preventDefault();if(e.code==='ArrowLeft'||e.code==='KeyA')keys.left=true;if(e.code==='ArrowRight'||e.code==='KeyD')keys.right=true;if(e.code==='Space'&&scene==='game'&&!e.repeat)jumpBoost();if(e.code==='Escape'&&scene==='game'&&!e.repeat)$('pause').click()});window.addEventListener('keyup',e=>{if(e.code==='ArrowLeft'||e.code==='KeyA')keys.left=false;if(e.code==='ArrowRight'||e.code==='KeyD')keys.right=false});window.addEventListener('blur',()=>{keys.left=keys.right=false;joystickAxis=0;resetJoystick();if(scene==='game'&&game&&!game.dead&&!game.done&&!game.paused)$('pause').click()});
// Touch-drag on the canvas also steers the ball, making one-thumb play possible.
// Joystick steers horizontally only. Jumping requires the separate JUMP button.
screen('home');})();
