export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function cropRectangle(width: number, height: number, zoom: number, x: number, y: number) {
  if (![width, height, zoom, x, y].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error("Invalid image dimensions");
  const side = Math.min(width, height) / clamp(zoom, 1, 3);
  return { left: (width - side) * (1 + clamp(x, -1, 1)) / 2,
    top: (height - side) * (1 + clamp(y, -1, 1)) / 2, side };
}
