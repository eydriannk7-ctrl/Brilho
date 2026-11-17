(() => {
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  if (!ctx) return;

  let w = 0, h = 0, dpr = 1;
  let particles = [], dust = [];
  let rotY = .15, rotX = -.12, targetY = .15, targetX = -.12;
  let dragging = false, lastX = 0, lastY = 0;
  let startTime = performance.now();
  let frameId = 0;

  const rand = (a, b) => a + Math.random() * (b - a);

  function heartPoint() {
    const t = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random());
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2*t)
            - 2 * Math.cos(3*t) - Math.cos(4*t);
    return {
      x: x * r, y: y * r,
      z: rand(-4.5, 4.5) * Math.sqrt(1-r*r) + Math.sin(t*3)*.4,
      size: rand(.55, 1.45),
      phase: rand(0, Math.PI*2),
      brightness: rand(.5, 1),
      scatter: rand(24, 170),
      seed: rand(0, 1000),
      delay: rand(0, 1.7)
    };
  }

  function makeScene() {
    // Limite dinâmico: evita milhares de partículas em telas grandes.
    const count = Math.max(1500, Math.min(3000, Math.floor(w*h/300)));
    particles = Array.from({length: count}, heartPoint);
    const dustCount = Math.min(180, Math.floor(w*h/9000));
    dust = Array.from({length: dustCount}, () => ({
      x: rand(-w/2,w/2), y: rand(-h/2,h/2),
      size: rand(.35,1.15), phase: rand(0,7), speed: rand(.3,1.1)
    }));
    startTime = performance.now();
  }

  function resize() {
    // DPR menor reduz bastante a quantidade de pixels processados.
    dpr = Math.min(window.devicePixelRatio || 1, 1.35);
    w = innerWidth; h = innerHeight;
    canvas.width = Math.round(w*dpr);
    canvas.height = Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    makeScene();
  }

  function glow(x,y,r,a) {
    const g = ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,`rgba(255,45,65,${a})`);
    g.addColorStop(.38,`rgba(190,0,28,${a*.32})`);
    g.addColorStop(1,"rgba(120,0,18,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  }

  function drawBase(time) {
    const cx=w/2, cy=h*.79, width=Math.min(w*.34,150);
    const pulse=1+Math.sin(time*.002)*.025;
    ctx.save();
    ctx.translate(cx,cy); ctx.scale(1,.28);
    ctx.shadowBlur=0;
    for(let i=0;i<3;i++){
      ctx.beginPath();
      ctx.ellipse(0,0,width*pulse*(1+i*.13),width*.22*pulse*(1+i*.13),0,0,Math.PI*2);
      ctx.strokeStyle=`rgba(255,35,55,${.48-i*.1})`;
      ctx.lineWidth=i===0?2:1;
      ctx.stroke();
    }
    ctx.restore();
    glow(cx,cy,width*1.5,.09);
  }

  function draw(now) {
    const elapsed = now-startTime;
    const t = Math.min(1,Math.max(0,(elapsed-250)/2100));
    const assemble = 1-Math.pow(1-t,3);

    rotY += (targetY-rotY)*.045;
    rotX += (targetX-rotX)*.045;

    ctx.fillStyle="#100208";
    ctx.fillRect(0,0,w,h);

    // Fundo com um único halo por quadro.
    glow(w/2,h*.47,Math.min(w,h)*.32,.13+Math.sin(now*.0015)*.018);
    drawBase(now);

    for(const p of dust){
      const x=w/2+p.x+Math.sin(now*.0003*p.speed+p.phase)*9;
      const y=h/2+p.y+Math.cos(now*.00025*p.speed+p.phase)*8;
      const a=.12+(Math.sin(now*.0018+p.phase)+1)*.12;
      ctx.fillStyle=`rgba(255,105,120,${a})`;
      ctx.fillRect(x,y,p.size,p.size);
    }

    // Trigonometria da rotação é calculada uma vez, não para cada partícula.
    const cy=Math.cos(rotY), sy=Math.sin(rotY);
    const cx=Math.cos(rotX), sx=Math.sin(rotX);
    const scale=Math.min(w,h)/42;
    const perspectiveBase=520;
    const scatterFactor=1-assemble;

    // Sem map(), sort() ou shadowBlur individual: reduz muito o trabalho por quadro.
    // A profundidade é simulada pelo tamanho e transparência.
    for(let i=0;i<particles.length;i++){
      const p=particles[i];
      const scatter=scatterFactor*p.scatter;
      const x=p.x+Math.sin(p.seed+now*.00045)*scatter;
      const y=p.y+Math.cos(p.seed*.7+now*.0004)*scatter*.65;
      const z=p.z+Math.sin(p.seed*.4+now*.0005)*scatter;

      const x1=x*cy-z*sy;
      const z1=x*sy+z*cy;
      const y1=y*cx-z1*sx;
      const z2=y*sx+z1*cx;
      const perspective=perspectiveBase/(perspectiveBase+z2*scale*.72);

      const px=w/2+x1*scale*perspective;
      const py=h*.48-y1*scale*perspective;
      const depthAlpha=Math.max(.25,Math.min(1,1-z2/100));
      const pulse=.82+.18*Math.sin(now*.0025+p.phase);
      const alpha=p.brightness*depthAlpha*pulse;
      const radius=Math.max(.45,p.size*perspective*(scale/15));

      ctx.fillStyle=`rgba(255,${65+Math.floor(95*alpha)},${75+Math.floor(70*alpha)},${alpha})`;
      ctx.beginPath();
      ctx.arc(px,py,radius,0,Math.PI*2);
      ctx.fill();
    }

    // Letra B centralizada dentro do coração.
    // O tamanho acompanha a escala do coração e permanece legível durante a rotação.
    if (assemble > 0.72) {
      const fade = Math.min(1, (assemble - 0.72) / 0.28);
      ctx.save();
      ctx.globalAlpha = fade * 0.94;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${Math.max(28, Math.min(62, Math.min(w,h)*0.105))}px Georgia, serif`;
      ctx.fillStyle = "#ffe5e8";
      ctx.shadowColor = "#ff1838";
      ctx.shadowBlur = 24;
      ctx.fillText("B", w/2, h*0.47);
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#ff8a98";
      ctx.fillText("B", w/2, h*0.47);
      ctx.restore();
    }

    // Brilhos pontuais em poucos pontos, em vez de aplicar sombra em milhares.
    ctx.save();
    ctx.globalCompositeOperation="lighter";
    for(let i=0;i<particles.length;i+=95){
      const p=particles[i];
      const x=p.x, y=p.y, z=p.z;
      const x1=x*cy-z*sy, z1=x*sy+z*cy;
      const y1=y*cx-z1*sx;
      const perspective=perspectiveBase/(perspectiveBase+(z1*cx-y*sx)*scale*.72);
      const px=w/2+x1*scale*perspective;
      const py=h*.48-y1*scale*perspective;
      ctx.fillStyle="rgba(255,55,75,.28)";
      ctx.fillRect(px-1,py-1,2,2);
    }
    ctx.restore();

    frameId=requestAnimationFrame(draw);
  }

  canvas.addEventListener("pointerdown",e=>{
    dragging=true; lastX=e.clientX; lastY=e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove",e=>{
    if(!dragging)return;
    targetY+=(e.clientX-lastX)*.008;
    targetX+=(e.clientY-lastY)*.008;
    targetX=Math.max(-1.15,Math.min(1.15,targetX));
    lastX=e.clientX; lastY=e.clientY;
  });
  canvas.addEventListener("pointerup",()=>dragging=false);
  canvas.addEventListener("pointercancel",()=>dragging=false);
  canvas.addEventListener("click",()=>{startTime=performance.now();});
  window.addEventListener("resize",resize);

  resize();
  cancelAnimationFrame(frameId);
  frameId=requestAnimationFrame(draw);
})();
