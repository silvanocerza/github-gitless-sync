import { createContext, useContext } from "react";
import GitHubSyncPlugin from "src/main";

export const PluginContext = createContext<GitHubSyncPlugin | undefined>(
  undefined,
);

export const usePlugin = (): GitHubSyncPlugin | undefined => {
  return useContext(PluginContext);
};
