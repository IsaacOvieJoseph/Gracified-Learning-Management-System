import React, { useRef, useEffect, useState, useContext } from 'react';
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_WS_URL || 'http://localhost:5000';

export default function Whiteboard() {
  const { classId: paramClassId } = useParams();
  const classId = paramClassId;
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const canvasHeightRef = useRef(4000);
  const socketRef = useRef(null);
  const containerRef = useRef(null);
  const [otherCursors, setOtherCursors] = useState({});
  const lastCursorEmitRef = useRef(0);
  const { user } = useAuth();
  const [isDrawing, setIsDrawing] = useState(false);
  const [locked, setLocked] = useState(false);
  const [followEnabled, setFollowEnabled] = useState(false);

  const isTeacher = user && (user.role === 'teacher' || user.role === 'personal_teacher' || user.role === 'school_admin' || user.role === 'root_admin');

  useEffect(() => {
    const canvas = canvasRef.current;
    // initial dimensions: full width, tall height so users can scroll vertically
    canvas.width = canvas.clientWidth;
    canvas.height = canvasHeightRef.current;
    canvas.style.height = `${canvas.height}px`;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctxRef.current = ctx;

    const ensureCanvasHeight = (minHeight) => {
      if (minHeight <= canvas.height) return;
      // copy existing content
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(canvas, 0, 0);
      // increase height
      canvas.height = minHeight;
      canvas.style.height = `${canvas.height}px`;
      const newCtx = canvas.getContext('2d');
      newCtx.drawImage(tmp, 0, 0);
      ctxRef.current = newCtx;
      canvasHeightRef.current = canvas.height;
    };

    const token = localStorage.getItem('token') || '';
    const socket = io(SOCKET_URL, { transports: ['websocket'], auth: { token: token ? `Bearer ${token}` : '' } });
    socketRef.current = socket;
    socket.emit('wb:join', { classId });

    socket.on('wb:draw', ({ prev, curr, color, width }) => {
      // remote strokes are stored normalized; draw by converting to pixels
      drawLine(prev, curr, color, width, false);
    });

    socket.on('wb:cursor', (payload) => {
      // payload: { socketId, xNorm, yNorm, name, color }
      setOtherCursors((prev) => ({ ...prev, [payload.socketId]: { ...payload, lastSeen: Date.now() } }));
    });

    socket.on('wb:viewport', ({ scrollTopNorm, teacherSocketId }) => {
      // when teacher broadcasts viewport and follow mode is enabled, students follow
      if (!isTeacher && followEnabled && containerRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const maxScroll = Math.max(0, canvas.height - container.clientHeight);
        const newTop = Math.max(0, Math.min(1, scrollTopNorm)) * maxScroll;
        container.scrollTop = newTop;
      }
    });

    socket.on('wb:clear', () => {
      clearCanvas(false);
    });

    socket.on('wb:lock-state', ({ locked }) => {
      setLocked(!!locked);
    });
    socket.on('wb:follow-state', ({ follow }) => {
      setFollowEnabled(!!follow);
    });

    socket.on('wb:history', (strokes) => {
      try {
        // draw persisted strokes in order
        strokes.forEach((s) => {
          drawLine(s.prev, s.curr, s.color || '#000', s.width || 2, false);
        });
      } catch (err) {
        console.error('Error replaying history', err);
      }
    });

    // cleanup stale cursors periodically
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setOtherCursors((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (now - next[k].lastSeen > 8000) delete next[k];
        });
        return next;
      });
    }, 3000);

    return () => {
      clearInterval(cleanupInterval);
      socket.emit('wb:leave');
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  function drawLine(prev, curr, color = '#000', width = 2, emit = true) {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    // helper converts normalized (0..1) coords to pixels if needed
    const toPixels = (pt) => {
      if (pt == null) return pt;
      // if coordinates look normalized (0..1), convert
      if (pt.x <= 1 && pt.y <= 1) {
        return { x: pt.x * canvas.width, y: pt.y * canvas.height };
      }
      return pt;
    };

    const p1 = toPixels(prev);
    const p2 = toPixels(curr);

    // dynamically expand canvas if drawing near bottom
    const margin = 200;
    if (p2.y > canvas.height - margin) {
      const newH = canvas.height + 3000;
      // preserve content while expanding
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(canvas, 0, 0);
      canvas.height = newH;
      canvas.style.height = `${canvas.height}px`;
      const newCtx = canvas.getContext('2d');
      newCtx.drawImage(tmp, 0, 0);
      ctxRef.current = newCtx;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.closePath();

    if (!emit) return;
    // emit normalized coords so strokes replay correctly on different client sizes
    const norm = (pt) => ({ x: pt.x / canvas.width, y: pt.y / canvas.height });
    socketRef.current.emit('wb:draw', { prev: norm(p1), curr: norm(p2), color, width });
  }

  function clearCanvas(emit = true) {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (emit) socketRef.current.emit('wb:clear');
  }

  function getPointerPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left), y: (t.clientY - rect.top) };
    }
    return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
  }

  const handlePointerDown = (e) => {
    if (locked && !isTeacher) return;
    setIsDrawing(true);
    const pos = getPointerPos(e);
    socketRef.current._lastPos = pos;
  };
  const handlePointerMove = (e) => {
    if (!isDrawing || (locked && !isTeacher)) return;
    const pos = getPointerPos(e);
    const prev = socketRef.current._lastPos || pos;
    drawLine(prev, pos, '#000', 2, true);
    socketRef.current._lastPos = pos;
    // emit cursor position (normalized) throttled
    try {
      const now = Date.now();
      if (now - lastCursorEmitRef.current > 80) {
        const canvas = canvasRef.current;
        const xNorm = pos.x / canvas.width;
        const yNorm = pos.y / canvas.height;
        socketRef.current.emit('wb:cursor', { xNorm, yNorm });
        lastCursorEmitRef.current = now;
      }
    } catch (err) {
      // ignore
    }
  };
  const handlePointerUp = () => {
    setIsDrawing(false);
    if (socketRef.current) socketRef.current._lastPos = null;
  };

  const onClear = () => {
    if (!isTeacher) return;
    clearCanvas(true);
  };

  const onToggleLock = () => {
    if (!isTeacher) return;
    socketRef.current.emit('wb:lock', { locked: !locked });
    setLocked(!locked);
  };

  // teacher: emit viewport on scroll when locked; students: follow teacher when locked
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !socketRef.current) return;

    let lastEmit = 0;
    const onScroll = () => {
      if (!socketRef.current) return;
      if (!isTeacher) return;
      if (!whiteboardSessionLocked()) return; // helper below
      const now = Date.now();
      if (now - lastEmit < 100) return;
      lastEmit = now;
      const canvas = canvasRef.current;
      const maxScroll = Math.max(0, canvas.height - container.clientHeight);
      const scrollTopNorm = maxScroll > 0 ? container.scrollTop / maxScroll : 0;
      socketRef.current.emit('wb:viewport', { scrollTopNorm });
    };

    if (isTeacher) {
      container.addEventListener('scroll', onScroll, { passive: true });
    }

    return () => {
      if (isTeacher) container.removeEventListener('scroll', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, locked]);

  function whiteboardSessionLocked() {
    // prefer server lock state; local locked state is okay as an approximation
    return !!locked;
  }

  return (
    <div className="p-4 h-full" style={{ height: '100%' }}>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-semibold">Whiteboard</h3>
        {isTeacher && <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={onClear}>Clear</button>}
        {isTeacher && <button className="px-3 py-1 bg-gray-700 text-white rounded" onClick={onToggleLock}>{locked ? 'Unlock' : 'Lock'}</button>}
        {isTeacher && <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={() => { socketRef.current?.emit('wb:follow', { follow: !followEnabled }); setFollowEnabled(!followEnabled); }}>{followEnabled ? 'Disable Follow' : 'Enable Follow'}</button>}
        <div className="ml-auto">{locked ? 'Locked' : 'Open'}</div>
      </div>
      <div ref={containerRef} style={{ height: 'calc(100vh - 140px)', overflowY: 'auto', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: `${canvasHeightRef.current}px`, border: '1px solid #e5e7eb', touchAction: 'none', display: 'block' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />

        {/* render other users' cursors */}
        {Object.keys(otherCursors).map((id) => {
          const c = otherCursors[id];
          if (!c) return null;
          const canvas = canvasRef.current;
          const container = containerRef.current;
          if (!canvas || !container) return null;
          const px = c.xNorm * canvas.width;
          const py = c.yNorm * canvas.height - container.scrollTop;
          return (
            <div key={id} style={{ position: 'absolute', left: px + 8, top: py - 8, pointerEvents: 'none', zIndex: 40 }}>
              <div style={{ background: c.color || '#000', color: '#fff', padding: '2px 6px', borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap' }}>{c.name}</div>
              <div style={{ width: 8, height: 8, background: c.color || '#000', borderRadius: '50%', marginTop: 4 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
