import { useEffect, useRef, useState } from "react";

/**
 * 🩺 CareScribe Vitality Cross & Micro-Pulse Cursor
 * 
 * Unique, Compact & Medical Design:
 * 1. Compact Luminous Medical Cross: 14px 3D gradient healthcare cross with crisp white core
 * 2. Breathing Cardiac Vital Aura: 22px soft concentric pulse that breathes at a calm 72 BPM
 * 3. Micro Vitality Droplet Trail: 3-4 micro fluid vital beads trailing closely behind movement
 * 4. Small Footprint: Total size ~22px (neat, sharp, never blocks buttons, text, or forms)
 * 5. Interactive Clinical Lock on Hover: Rotates 45° with a brilliant medical teal glow
 * 6. Micro Cardiac Echo on Click: Crisp concentric vital pulse
 * 7. 100% Non-intrusive: pointer-events: none (zero obstruction to clicks, selections, or inputs)
 */
export default function CustomCursor() {
  const canvasRef = useRef(null);
  const headRef = useRef(null);

  const mouse = useRef({ x: -100, y: -100 });
  const droplets = useRef([]);
  const ripples = useRef([]);
  const isHovered = useRef(false);
  const isVisible = useRef(false);

  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const head = headRef.current;
    if (!canvas || !ctx || !head) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let animId;
    let prev = { x: -100, y: -100 };

    const onMouseMove = (e) => {
      const x = e.clientX;
      const y = e.clientY;
      mouse.current = { x, y };

      if (!isVisible.current) {
        isVisible.current = true;
        head.style.opacity = "1";
        canvas.style.opacity = "1";
      }

      // Fast hardware-accelerated movement for head
      head.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;

      // Spawn micro vital droplets behind movement
      const dx = x - prev.x;
      const dy = y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 3) {
        droplets.current.push({
          x: x + (Math.random() - 0.5) * 2,
          y: y + (Math.random() - 0.5) * 2,
          size: Math.min(dist * 0.22 + 1.2, 3),
          alpha: 0.7,
        });
      }
      prev = { x, y };

      // Interactive element detection
      const target = e.target;
      const isInteractive = Boolean(
        target.closest(
          'a, button, input, select, textarea, label, [role="button"], .cursor-pointer, .btn, .interactive, [tabindex]:not([tabindex="-1"])'
        )
      );

      if (isInteractive !== isHovered.current) {
        isHovered.current = isInteractive;
        if (isInteractive) {
          head.classList.add("cursor-hover");
        } else {
          head.classList.remove("cursor-hover");
        }
      }
    };

    // Micro Cardiac Echo on Click
    const onMouseDown = (e) => {
      head.classList.add("cursor-click");
      ripples.current.push({
        x: e.clientX,
        y: e.clientY,
        radius: 4,
        maxRadius: 22,
        alpha: 0.85,
      });
    };

    const onMouseUp = () => {
      head.classList.remove("cursor-click");
    };

    const onMouseLeave = () => {
      isVisible.current = false;
      head.style.opacity = "0";
      canvas.style.opacity = "0";
    };

    const onMouseEnter = () => {
      isVisible.current = true;
      head.style.opacity = "1";
      canvas.style.opacity = "1";
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    // 60FPS Micro-vital beads & cardiac ripples
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Render Micro Vital Droplets (Smooth & Short Trail)
      for (let i = droplets.current.length - 1; i >= 0; i--) {
        const d = droplets.current[i];
        d.size *= 0.88;
        d.alpha *= 0.86;

        if (d.alpha < 0.05 || d.size < 0.4) {
          droplets.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fillStyle = isHovered.current
          ? `rgba(13, 148, 136, ${d.alpha})`
          : `rgba(14, 165, 233, ${d.alpha})`;
        ctx.shadowBlur = 4;
        ctx.shadowColor = "#38bdf8";
        ctx.fill();
        ctx.restore();
      }

      // 2. Render Micro Cardiac Echo Ripples on Click
      for (let i = ripples.current.length - 1; i >= 0; i--) {
        const r = ripples.current[i];
        r.radius += (r.maxRadius - r.radius) * 0.18 + 0.6;
        r.alpha *= 0.88;

        if (r.alpha < 0.04) {
          ripples.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(14, 165, 233, ${r.alpha})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <style>{`
        /* 🩺 CareScribe Vitality Cross Cursor */
        
        /* Completely hide all native cursors (arrow, hand pointer, text beam, etc.) */
        *, *::before, *::after, html, body, a, button, input, select, textarea, label, [role="button"], .cursor-pointer, [style*="cursor"] {
          cursor: none !important;
        }

        .vital-cursor-canvas {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          z-index: 999998;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .vital-cursor-head {
          position: fixed;
          top: 0;
          left: 0;
          width: 22px;
          height: 22px;
          pointer-events: none;
          z-index: 999999;
          opacity: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s ease, transform 0.04s ease-out;
          will-change: transform;
        }

        /* Living Cardiac Vital Aura (20px breathing ring) */
        .vital-aura-ring {
          position: absolute;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 1px solid rgba(14, 165, 233, 0.4);
          background: radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, transparent 70%);
          animation: vitalBreathing 1.8s ease-in-out infinite;
          transition: all 0.22s ease;
        }

        @keyframes vitalBreathing {
          0% { transform: scale(0.9); opacity: 0.5; }
          20% { transform: scale(1.15); opacity: 0.9; border-color: rgba(14, 165, 233, 0.7); }
          40% { transform: scale(1); opacity: 0.65; }
          60% { transform: scale(1.22); opacity: 0.95; border-color: rgba(13, 148, 136, 0.8); }
          80% { transform: scale(0.95); opacity: 0.6; }
          100% { transform: scale(0.9); opacity: 0.5; }
        }

        /* 3D Hospital Medical Cross (14px) */
        .vital-cross-svg {
          width: 14px;
          height: 14px;
          position: relative;
          z-index: 2;
          filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.25)) drop-shadow(0 0 4px rgba(14, 165, 233, 0.6));
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .cross-body {
          fill: url(#crossGrad);
          stroke: #ffffff;
          stroke-width: 1.2;
          stroke-linejoin: round;
        }

        .cross-dot {
          fill: #ffffff;
        }

        /* Hover on Interactive Elements (Buttons, Inputs, Links) */
        .vital-cursor-head.cursor-hover .vital-aura-ring {
          width: 26px;
          height: 26px;
          border-color: #0d9488;
          background: radial-gradient(circle, rgba(13, 148, 136, 0.25) 0%, transparent 75%);
          animation: none;
          box-shadow: 0 0 8px rgba(13, 148, 136, 0.5);
        }

        .vital-cursor-head.cursor-hover .vital-cross-svg {
          transform: scale(1.15) rotate(45deg);
          filter: drop-shadow(0 0 6px #38bdf8) drop-shadow(0 0 10px rgba(13, 148, 136, 0.8));
        }

        .vital-cursor-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Smooth scale bounce on inner element — never alters head coordinates! */
        .vital-cursor-head.cursor-click .vital-cursor-inner {
          transform: scale(0.82);
        }
      `}</style>

      {/* Canvas for micro-vital droplets trail & click ripple */}
      <canvas ref={canvasRef} className="vital-cursor-canvas" />

      {/* Compact 22px Vitality Cross Head */}
      <div ref={headRef} className="vital-cursor-head">
        <div className="vital-cursor-inner">
          {/* Breathing Cardiac Vital Ring */}
          <div className="vital-aura-ring" />

          {/* 14px Hospital Cross with Heart Pulse Center */}
          <svg
            className="vital-cross-svg"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="crossGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>

            {/* Precision Medical Cross */}
            <path
              className="cross-body"
              d="M8.5 2.5H15.5V8.5H21.5V15.5H15.5V21.5H8.5V15.5H2.5V8.5H8.5V2.5Z"
            />

            {/* Micro Heartbeat Core Dot */}
            <circle className="cross-dot" cx="12" cy="12" r="1.8" />
          </svg>
        </div>
      </div>
    </>
  );
}
