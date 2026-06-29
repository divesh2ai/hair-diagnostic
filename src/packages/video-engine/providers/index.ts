import type { VideoProvider, VideoProviderName } from "../types";
import { stubVideoProvider } from "./stub";
import { heygenVideoProvider } from "./heygen";
import { akoolVideoProvider } from "./akool";

export function getVideoProvider(name?: VideoProviderName | string | null): VideoProvider {
  const resolved = (name ?? process.env.VIDEO_PROVIDER ?? "stub") as VideoProviderName;
  switch (resolved) {
    case "stub":
      return stubVideoProvider;
    case "heygen":
      return heygenVideoProvider;
    case "akool":
      return akoolVideoProvider;
    // case "did":    return didProvider;
    // case "synthesia": return synthesiaProvider;
    default:
      return stubVideoProvider;
  }
}
