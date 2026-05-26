import { describe, expect, it } from "vitest";
import { PiiDetector } from "../src/infrastructure/security/PiiDetector.js";

describe("PiiDetector", () => {
  const detector = new PiiDetector(["Alice Example", "Bob Example"]);

  it("detects an email address", () => {
    expect(detector.containsEmail("contact alice.example@asos.invalid for details")).toBe(true);
    expect(detector.findEmail("contact alice.example@asos.invalid for details")).toBe(
      "alice.example@asos.invalid"
    );
  });

  it("flags absence of emails", () => {
    expect(detector.containsEmail("no addresses here")).toBe(false);
    expect(detector.findEmail("no addresses here")).toBeNull();
  });

  it("detects a known name", () => {
    expect(detector.containsKnownName("Please escalate to Alice Example.")).toBe("Alice Example");
  });

  it("returns null when no name is present", () => {
    expect(detector.containsKnownName("Senior Merch Planner approved")).toBeNull();
  });
});
