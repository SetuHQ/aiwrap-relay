import { arch, platform } from "node:os";

export function assertMacOS() {
  if (platform() !== "darwin") {
    throw new Error("aiwrap currently supports macOS only.");
  }
}

export function macArch(): "arm64" | "x64" {
  const value = arch();
  if (value === "arm64") return "arm64";
  if (value === "x64") return "x64";
  throw new Error(`Unsupported macOS architecture: ${value}`);
}
