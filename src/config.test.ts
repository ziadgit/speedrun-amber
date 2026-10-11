import { expect, test } from "bun:test";
import { loadConfig } from "./config";

test("defaults", () => {
  expect(loadConfig({})).toEqual({
    apiUrl: "http://127.0.0.1:8000",
    model: undefined,
    darwinMcpUrl: "https://mcp.darwin.so/mcp",
    appOrigin: "http://localhost:5173",
    port: 4000,
  });
});

test("strips trailing slash from API_URL", () => {
  expect(loadConfig({ API_URL: "http://x:1//" }).apiUrl).toBe("http://x:1");
});

test("accepts port 0 and reads MODEL", () => {
  const c = loadConfig({ PORT: "0", MODEL: "m" });
  expect(c.port).toBe(0);
  expect(c.model).toBe("m");
});

test("rejects bad APP_ORIGIN", () => {
  for (const v of ["*", "not a url", "http://a.com/path"]) {
    expect(() => loadConfig({ APP_ORIGIN: v })).toThrow("APP_ORIGIN");
  }
});

test("rejects bad PORT", () => {
  for (const v of ["abc", "-1", "65536", "1.5"]) {
    expect(() => loadConfig({ PORT: v })).toThrow("PORT");
  }
});
