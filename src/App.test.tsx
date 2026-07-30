import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the shuangpin learning keyboard", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "双拼辅助键盘" })).toBeInTheDocument();
  });
});
