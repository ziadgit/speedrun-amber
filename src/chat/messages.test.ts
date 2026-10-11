import { expect, test } from "bun:test";
import { changedMessage, resourceForTool } from "./messages";

test("maps the three write tools", () => {
  expect(resourceForTool("save_job")).toBe("jobs");
  expect(resourceForTool("save_variant")).toBe("variants");
  expect(resourceForTool("log_time_saved")).toBe("time-saved");
});

test("strips one MCP prefix", () => {
  for (const p of ["cv_", "cv__", "cv.", "cv/"]) {
    expect(resourceForTool(`${p}save_job`)).toBe("jobs");
  }
  expect(resourceForTool("cv_cv_save_job")).toBeNull();
});

test("other tools and inherited keys give null", () => {
  expect(resourceForTool("get_profile")).toBeNull();
  expect(resourceForTool("search")).toBeNull();
  expect(resourceForTool("toString")).toBeNull();
  expect(resourceForTool("")).toBeNull();
});

test("changedMessage shape", () => {
  expect(changedMessage("jobs")).toEqual({ type: "speedhack:changed", resource: "jobs" });
});
