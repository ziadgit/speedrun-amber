import { describe, expect, test } from "bun:test";
import { changedMessage, createChangeTracker, resourceForTool } from "./messages";

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

const ok = JSON.stringify({ content: [{ type: "text", text: '{"id":"j1"}' }] });
const fail = JSON.stringify({ content: [{ type: "text", text: "save_variant failed: 422" }], isError: true });

describe("createChangeTracker", () => {
  const setup = () => {
    const posted: unknown[] = [];
    return { posted, tracker: createChangeTracker((m) => posted.push(m)) };
  };

  test("posts once per successful cv-tools call", () => {
    const { posted, tracker } = setup();
    tracker.started("t1", "cv_save_job");
    tracker.result("t1", ok);
    tracker.result("t1", ok);
    expect(posted).toEqual([{ type: "speedhack:changed", resource: "jobs" }]);
  });

  test("ignores failures, read tools and unknown calls", () => {
    const { posted, tracker } = setup();
    tracker.started("t1", "save_variant");
    tracker.result("t1", fail);
    tracker.started("t2", "get_profile");
    tracker.result("t2", ok);
    tracker.result("t3", ok);
    expect(posted).toEqual([]);
  });

  test("falls back to the failed-text prefix when content is not JSON", () => {
    const { posted, tracker } = setup();
    tracker.started("t1", "save_job");
    tracker.result("t1", "save_job failed: 500");
    expect(posted).toEqual([]);
  });
});
