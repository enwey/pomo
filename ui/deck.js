let deckState=null;
function initDeck(data){
  if(deckState){deckState.animations?.forEach(a=>a.cancel());deckState.observer?.disconnect()}
  const rail=$('.rail');rail.classList.add('deck');
  const elements=[...rail.querySelectorAll('.card')],count=data.length;
  const s={rail,elements,data,busy:false,drag:null,ignoreClick:false,animations:[],phase:'idle',flow:1,previewSign:1};deckState=s;
  const normalize=i=>((i%count)+count)%count;
  const front='translate3d(0,0,0) scale(1) rotate(0deg)';
  const layer=d=>`translate3d(0,${-10*d}px,0) scale(${1-d*.035}) rotate(${d===1?-1.4:1.3}deg)`;
  const valid=()=>deckState===s&&rail.isConnected;
  const outside=()=>rail.clientWidth+75;
  const palette=['var(--sage)','var(--sand)','var(--mist)'];
  elements.forEach((el,i)=>{let color=i%3;if(count>1&&i===count-1&&color===0)color=1;el.style.backgroundColor=palette[color]});
  function layout(step=s.flow){
    elements.forEach((el,i)=>{
      const depth=normalize((i-index)*step),isFront=depth===0,behind=depth>0&&depth<=2;
      el.classList.toggle('is-front',isFront);el.classList.toggle('is-behind',behind);el.classList.toggle('is-away',!isFront&&!behind);el.classList.remove('is-leaving','is-returning','is-recycling');
      el.style.transition='none';el.style.zIndex=isFront?10:behind?10-depth:0;
      el.style.transform=isFront?front:behind?layer(depth):front;el.style.opacity=isFront||behind?'1':'0';
      el.inert=!isFront;el.setAttribute('aria-hidden',String(!isFront));
    });
  }
  function controls(){
    document.querySelectorAll('.dot').forEach((el,i)=>{el.classList.toggle('on',i===index);el.setAttribute('aria-current',i===index?'true':'false')});
    if($('#pos'))$('#pos').textContent=`${index+1} / ${count} · ${data[index].title}`;
  }
  function paint(){if(!valid())return;layout();controls();if(!rail.closest('.result-minimal'))rail.style.height=(elements[index].offsetHeight+37)+'px'}
  function preview(dx){
    const progress=Math.min(1,Math.abs(dx)/rail.clientWidth),sign=dx<0?-1:1;s.previewSign=sign;layout(sign);
    elements[index].style.transform=`translate3d(${dx}px,${Math.abs(dx)*.025}px,0) rotate(${sign*Math.min(10,Math.abs(dx)/36)}deg)`;
    if(count>1)elements[normalize(index+sign)].style.transform=`translate3d(0,${-10*(1-progress)}px,0) scale(${.965+progress*.035}) rotate(${-1.4*(1-progress)}deg)`;
  }
  async function motion(moves,duration){
    const animations=moves.map(([el,to])=>el.animate([{transform:getComputedStyle(el).transform,opacity:getComputedStyle(el).opacity},typeof to==='string'?{transform:to}:to],{duration,easing:'cubic-bezier(.22,.75,.25,1)',fill:'forwards'}));
    s.animations=animations;await Promise.allSettled(animations.map(a=>a.finished));
    if(!valid())return false;
    moves.forEach(([el,to])=>{if(typeof to==='string')el.style.transform=to;else{el.style.transform=to.transform;if(to.opacity!==undefined)el.style.opacity=to.opacity}});
    animations.forEach(a=>a.cancel());s.animations=[];return true;
  }
  function unlock(){
    paint();s.busy=false;s.phase='idle';
    if(s.pending){const p=s.pending;delete s.pending;if(p.step)s.go(normalize(index+p.sign),p.sign);else if(p.target!==index)s.go(p.target,p.sign)}
  }
  s.paint=paint;
  s.go=async function(target,sign=1){
    target=normalize(target);if(s.busy||target===index)return;
    if(elements[index].contains(document.activeElement))rail.focus({preventScroll:true});
    s.busy=true;s.phase='out';const old=elements[index],next=elements[target],previousIndex=index;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){s.flow=sign;index=target;unlock();return}
    const visible=new Set([old,next,elements[normalize(target+sign)],elements[normalize(target+2*sign)]]);
    elements.forEach(el=>{if(!visible.has(el)){el.classList.remove('is-behind');el.classList.add('is-away');el.style.opacity='0';el.style.zIndex='0'}});
    const targetHidden=next.classList.contains('is-away');next.classList.remove('is-away');next.style.opacity='1';next.style.zIndex='9';
    if(targetHidden)next.style.transform=layer(1);
    old.classList.add('is-leaving');
    const moves=[[old,`translate3d(${sign*outside()}px,12px,0) rotate(${sign*11}deg)`],[next,front]];
    // The whole visible stack rises as the front card exits on either side.
    for(let d=1;d<=2;d++){
      const el=elements[normalize(target+d*sign)];if(el===old||el===next)continue;
      el.classList.remove('is-away');el.classList.add('is-behind');el.style.opacity='1';el.style.zIndex=String(9-d);
      if(normalize((normalize(target+d*sign)-previousIndex)*s.flow)>2)el.style.transform=layer(d+1);
      moves.push([el,layer(d)]);
    }
    if(!await motion(moves,210))return;
    // Reinsert on the same side UNDER the stack, never through its front.
    s.phase='under';old.classList.remove('is-front');old.classList.add('is-recycling');old.style.zIndex='0';old.inert=true;old.setAttribute('aria-hidden','true');
    next.classList.add('is-front');next.classList.remove('is-behind');next.style.zIndex='10';next.inert=false;next.setAttribute('aria-hidden','false');
    s.flow=sign;index=target;controls();
    if(!await motion([[old,{transform:layer(3),opacity:'0'}]],150))return;
    unlock();
  };
  s.snapBack=async function(){
    s.busy=true;s.phase='snap';
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const moves=[[elements[index],front]];if(count>1)moves.push([elements[normalize(index+s.previewSign)],layer(1)]);
      if(!await motion(moves,190))return;
    }
    s.flow=s.previewSign;unlock();
  };
  paint();
  const observer=new ResizeObserver(()=>{if(!rail.isConnected){observer.disconnect();return}if(!rail.closest('.result-minimal'))rail.style.height=(elements[index].offsetHeight+37)+'px'});observer.observe(elements[index]);s.observer=observer;
  rail.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();deckStep(e.key==='ArrowRight'?1:-1)}};
  rail.onpointerdown=e=>{
    if(s.busy||s.drag||e.isPrimary===false||e.button!==0||e.target.closest('button,input,a'))return;
    s.ignoreClick=false;s.previewSign=s.flow;s.drag={x:e.clientX,y:e.clientY,dx:0,t:performance.now(),active:false,id:e.pointerId};
  };
  rail.onpointermove=e=>{
    const d=s.drag;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.active){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*1.2){s.drag=null;return}if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.1)return;d.active=true;rail.setPointerCapture(e.pointerId);rail.classList.add('is-dragging')}
    d.dx=dx;s.ignoreClick=true;preview(dx);
  };
  function finish(cancel=false){
    const d=s.drag;s.drag=null;rail.classList.remove('is-dragging');if(!d)return;
    if(rail.hasPointerCapture(d.id))rail.releasePointerCapture(d.id);
    if(d.active){const fast=Math.abs(d.dx)>25&&Math.abs(d.dx)/Math.max(1,performance.now()-d.t)>.45;if(!cancel&&(Math.abs(d.dx)>rail.clientWidth*.2||fast))s.go(normalize(index+(d.dx<0?-1:1)),d.dx<0?-1:1);else s.snapBack()}
    setTimeout(()=>{s.ignoreClick=false},0);
  }
  rail.onpointerup=e=>{if(s.drag?.id===e.pointerId)finish()};rail.onpointercancel=e=>{if(s.drag?.id===e.pointerId)finish(true)};
  rail.onlostpointercapture=e=>{if(e.target===rail&&s.drag?.id===e.pointerId)finish(true)};
  rail.addEventListener('click',e=>{if(s.ignoreClick){e.preventDefault();e.stopPropagation();s.ignoreClick=false}},true);
}
function deckGo(i){const s=deckState;if(!s||!s.rail.isConnected||s.drag)return;const target=((i%s.data.length)+s.data.length)%s.data.length;const sign=(target-index+s.data.length)%s.data.length<=s.data.length/2?1:-1;if(s.busy){s.pending={target,sign};return}s.go(target,sign)}
function deckStep(sign){const s=deckState;if(!s||!s.rail.isConnected||s.drag)return;if(s.busy){s.pending={step:true,sign};return}s.go((index+sign+s.data.length)%s.data.length,sign)}
