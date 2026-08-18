import "@testing-library/jest-dom/vitest";

/** jsdom 未实现 ResizeObserver 的最小桩，供依赖它的组件在测试中挂载。 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
