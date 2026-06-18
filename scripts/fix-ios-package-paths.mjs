import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageFile = resolve("ios/App/CapApp-SPM/Package.swift");

try {
  const contents = await readFile(packageFile, "utf8");
  const normalized = contents.replaceAll("\\", "/");

  if (normalized !== contents) {
    await writeFile(packageFile, normalized, "utf8");
    console.log("Normalized Capacitor iOS package paths for Xcode.");
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
