"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Modal } from "./modal";
import { clamp, cropRectangle } from "./crop-geometry";
import { InlineSpinner } from "./loading-state";

export default function ImageCropper({ file, pending, error, onCancel, onSave }: {
  file: File; pending: boolean; error?: string; onCancel: () => void; onSave: (pngBase64: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; horizontal: number; vertical: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const picture = new Image();
    let active = true;
    picture.onload = () => {
      if (!active) return;
      if (picture.naturalWidth > 8192 || picture.naturalHeight > 8192 || picture.naturalWidth * picture.naturalHeight > 32_000_000) {
        setLoadError("This image is too large. Choose a photo under 32 megapixels and 8192 pixels per side.");
      } else setImage(picture);
    };
    picture.onerror = () => { if (active) setLoadError("This image could not be opened. Choose a PNG, JPEG, or WebP file."); };
    picture.src = url;
    return () => { active = false; picture.onload = null; picture.onerror = null; URL.revokeObjectURL(url); };
  }, [file]);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context || !image) return;
    const crop = cropRectangle(image.naturalWidth, image.naturalHeight, zoom, position.x, position.y);
    context.clearRect(0, 0, 256, 256);
    context.drawImage(image, crop.left, crop.top, crop.side, crop.side, 0, 0, 256, 256);
  }, [image, zoom, position]);
  function move(event: PointerEvent<HTMLCanvasElement>) {
    const start = drag.current;
    if (!start || !image || pending) return;
    const side = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const display = event.currentTarget.getBoundingClientRect().width;
    // Convert preview pixels into normalized source offsets; moving the picture moves the crop origin oppositely.
    setPosition({
      x: image.naturalWidth > side ? clamp(start.horizontal - 2 * (event.clientX - start.x) * side / (display * (image.naturalWidth - side)), -1, 1) : 0,
      y: image.naturalHeight > side ? clamp(start.vertical - 2 * (event.clientY - start.y) * side / (display * (image.naturalHeight - side)), -1, 1) : 0,
    });
  }
  return <Modal open onClose={() => { if (!pending) onCancel(); }} labelledBy="crop-title" className="crop-dialog">
    <div className="crop-content">
      <header><h2 id="crop-title">Crop profile picture</h2><p id="crop-help">Drag to reposition, or focus the picture and use the arrow keys. Adjust zoom below.</p></header>
      {loadError && <p className="notice error" role="alert">{loadError}</p>}
      {!image && !loadError && <p className="loading-label" role="status"><InlineSpinner />Opening image…</p>}
      <div className="crop-preview-frame"><canvas ref={canvas} width={256} height={256} className="crop-preview" tabIndex={image && !pending ? 0 : -1}
        role="img" aria-label="Profile crop preview" aria-describedby="crop-help"
        onPointerDown={(event) => { if (!image || pending) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, horizontal: position.x, vertical: position.y }; }}
        onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
        onKeyDown={(event) => {
          if (!image || pending || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault();
          const step = event.shiftKey ? 0.01 : 0.05;
          setPosition((current) => ({ x: clamp(current.x + (event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0), -1, 1),
            y: clamp(current.y + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0), -1, 1) }));
        }} /><span className="crop-circle-guide" aria-hidden="true" /></div>
      <label className="field">Zoom<input type="range" min="1" max="3" step="0.01" value={zoom} disabled={!image || pending} onChange={(event) => setZoom(Number(event.target.value))} /></label>
      <p className="subtle">The square crop is saved at 256 × 256 pixels. Profiles display it in a circle.</p>
      {error && <p role="alert" className="notice error">{error}</p>}
      <div className="actions crop-actions">
        <button type="button" className="button" disabled={pending} onClick={onCancel}>Cancel</button>
        <button type="button" className="button" disabled={!image || pending} onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}>Reset crop</button>
        <button type="button" className="button primary" disabled={!image || pending} onClick={() => {
          const result = canvas.current?.toDataURL("image/png").split(",")[1];
          if (result) onSave(result);
        }}>{pending && <InlineSpinner />}{pending ? "Saving…" : "Save picture"}</button>
      </div>
    </div>
  </Modal>;
}
