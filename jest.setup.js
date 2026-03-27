import "@testing-library/jest-dom";

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: jest.fn(),
});

Object.defineProperty(window, "requestAnimationFrame", {
  writable: true,
  value: (cb) => setTimeout(cb, 0),
});
