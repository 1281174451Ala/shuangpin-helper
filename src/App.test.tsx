import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the shuangpin learning keyboard", () => {
    render(<App />);

    // 检查虚拟键盘是否存在
    expect(screen.getByRole("region", { name: "双拼虚拟键盘" })).toBeInTheDocument();
  });
});
