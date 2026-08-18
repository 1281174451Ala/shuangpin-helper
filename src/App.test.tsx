import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the shuangpin learning keyboard", () => {
    render(<App />);

    // 检查虚拟键盘是否存在
    expect(screen.getByRole("region", { name: "双拼虚拟键盘" })).toBeInTheDocument();
  });

  it("renders candidate keys after a first letter and resets after the second letter", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^B/i })).toBeDisabled();

    fireEvent.keyDown(window, { key: "q" });
    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^B/i })).toBeEnabled();
  });

  it("ignores uppercase letters and letters typed with modifiers", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "D", shiftKey: true });
    fireEvent.keyDown(window, { key: "d", metaKey: true });

    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^B/i })).toBeEnabled();
  });

  it("clears candidates for space and Enter", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(window, { key: "d" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "false");
  });
});
