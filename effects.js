(() => {
  "use strict";
  const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  const normalize = value => ({
    type: ["snow", "embers", "none"].includes(value?.type) ? value.type : "snow",
    intensity: clamp(value?.intensity, 0, 100, 45), speed: clamp(value?.speed, .25, 2.5, 1)
  });
  const create = (canvas, initial) => {
    const context = canvas?.getContext("2d");
    if (!context) return {update: () => {}, stop: () => {}};
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let settings = normalize(initial), particles = [], width = 0, height = 0, frame = 0, last = 0, visible = true, destroyed = false;
    const reset = () => {
      const bounds = canvas.getBoundingClientRect(); width = bounds.width; height = bounds.height;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.round(Math.min(110, width / 14) * settings.intensity / 100);
      particles = Array.from({length: count}, () => ({x: Math.random()*width, y: Math.random()*height, r: .5+Math.random()*1.5, speed: 12+Math.random()*20, drift: 2+Math.random()*12}));
    };
    const running = () => !destroyed && !motion.matches && visible && !document.hidden && settings.type !== "none" && settings.intensity > 0;
    const draw = now => {
      frame = 0;
      if (!running()) return;
      const dt = last ? Math.min((now-last)/1000, .05)*settings.speed : 0; last = now;
      context.clearRect(0,0,width,height);
      context.fillStyle = settings.type === "embers" ? "rgba(232,153,75,.75)" : "rgba(229,239,245,.7)";
      for (const p of particles) {
        p.x += p.drift*dt; p.y += p.speed*dt*(settings.type === "embers" ? -1 : 1);
        if (p.y > height) p.y = -4;
        if (p.y < -5) p.y = height+3;
        if (p.x > width) p.x = 0;
        context.beginPath(); context.arc(p.x,p.y,p.r,0,2*Math.PI); context.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    const sync = () => {
      if (frame) cancelAnimationFrame(frame); frame = 0; last = 0;
      context.clearRect(0,0,width,height);
      if (running()) frame = requestAnimationFrame(draw);
    };
    const resize = () => {reset(); sync();};
    window.addEventListener("resize",resize);
    document.addEventListener("visibilitychange",sync);
    motion.addEventListener("change",sync);
    const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {visible = entries[0].isIntersecting; sync();}) : null;
    observer?.observe(canvas); reset(); sync();
    return {
      update: value => {settings = normalize(value); reset(); sync();},
      stop: () => {destroyed = true; sync(); observer?.disconnect(); window.removeEventListener("resize",resize); document.removeEventListener("visibilitychange",sync); motion.removeEventListener("change",sync);}
    };
  };
  window.RabenEffects = {create, normalize};
})();
