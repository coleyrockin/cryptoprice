import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LogoMark } from "./LogoMark";

describe("LogoMark", () => {
  it("falls back through logo sources and finally to monogram", async () => {
    render(
      <LogoMark
        name="Bitcoin"
        symbol="BTC"
        logoUrl="https://example.com/primary.png"
        fallbackLogoUrls={["https://example.com/fallback.png"]}
      />,
    );

    const first = screen.getByAltText("Bitcoin logo");
    expect(first).toHaveAttribute("src", "https://example.com/primary.png");

    fireEvent.error(first);

    await waitFor(() => {
      expect(screen.getByAltText("Bitcoin logo")).toHaveAttribute("src", "https://example.com/fallback.png");
    });

    fireEvent.error(screen.getByAltText("Bitcoin logo"));

    await waitFor(() => {
      expect(screen.getByText("BTC")).toBeInTheDocument();
    });
  });

  it("renders monogram immediately when no logo sources exist", () => {
    render(<LogoMark name="Silver" symbol="XAG" />);
    expect(screen.getByText("XAG")).toBeInTheDocument();
  });

  it("skips unsafe logo sources before rendering an image", () => {
    render(
      <LogoMark
        name="Bitcoin"
        symbol="BTC"
        logoUrl="//tracker.example/pixel.png"
        fallbackLogoUrls={["data:image/svg+xml,<svg></svg>", "https://example.com/fallback.png"]}
      />,
    );

    expect(screen.getByAltText("Bitcoin logo")).toHaveAttribute("src", "https://example.com/fallback.png");
  });
});
