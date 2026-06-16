/**
 * @test-file   RootLayout
 * @description unit tests for navigation shell rendering (Sidebar + BottomTabBar)
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY): Shengtian Liao @ [1]
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RootLayout } from "./RootLayout";

/**
 * @test-suite  RootLayout
 * @target      RootLayout component rendering
 * @strategy    unit, jsdom, no router context needed beyond MemoryRouter
 * @cases
 *   - [PASS] shows "RAG Local" heading when rendered in MemoryRouter
 *   - [PASS] shows all 5 nav labels when rendered in MemoryRouter
 */
describe("RootLayout", () => {
  it('shows "RAG Local" heading when rendered in MemoryRouter', () => {
    render(
      <MemoryRouter>
        <RootLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText("RAG Local")).toBeInTheDocument();
  });

  it("shows all 5 nav labels when rendered in MemoryRouter", () => {
    render(
      <MemoryRouter>
        <RootLayout />
      </MemoryRouter>,
    );
    ["Chat", "Knowledge", "History", "Quality", "Settings"].forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
  });
});
