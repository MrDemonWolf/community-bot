import { expect, test } from "bun:test";
import { cropRectangle } from "../apps/web/src/components/crop-geometry";

test("cropper centers a square in landscape and portrait images", () => {
  expect(cropRectangle(1200, 800, 1, 0, 0)).toEqual({ left: 200, top: 0, side: 800 });
  expect(cropRectangle(800, 1200, 1, 0, 0)).toEqual({ left: 0, top: 200, side: 800 });
});
test("zoom and dragged edges remain inside the original image", () => {
  const rectangle = cropRectangle(1200, 800, 3, 20, -20);
  expect(rectangle.left + rectangle.side).toBe(1200);
  expect(rectangle.top).toBe(0);
  expect(rectangle.side).toBeCloseTo(800 / 3);
});
test("invalid image dimensions cannot reach canvas rendering", () => {
  expect(() => cropRectangle(0, 800, 1, 0, 0)).toThrow();
  expect(() => cropRectangle(800, 800, Number.NaN, 0, 0)).toThrow();
});
