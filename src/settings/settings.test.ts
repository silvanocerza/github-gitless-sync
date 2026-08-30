import test from "node:test";
import * as assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  GitHubSyncSettings,
  isSyncConfigured,
  migrateSettings,
} from "./settings";

// Mimics how the plugin loads the data saved in the vault
const load = (saved: object): GitHubSyncSettings =>
  Object.assign({}, DEFAULT_SETTINGS, saved);

test("migrates the repository of vaults synced with older versions", () => {
  const settings = load({
    firstSync: false,
    githubToken: "token",
    githubOwner: "owner",
    githubRepo: "repo",
    githubBranch: "main",
  });

  assert.equal(migrateSettings(settings), true);
  assert.equal(settings.githubRepoUrl, "https://github.com/owner/repo");
  assert.equal("githubOwner" in settings, false);
  assert.equal("githubRepo" in settings, false);
  // The vault must keep syncing without going through the first sync again
  assert.equal(isSyncConfigured(settings), true);
  assert.equal(migrateSettings(settings), false);
});

test("drops the legacy settings of an incomplete setup", () => {
  const settings = load({ githubOwner: "owner", githubBranch: "main" });

  assert.equal(migrateSettings(settings), true);
  assert.equal(settings.githubRepoUrl, "");
  assert.equal(isSyncConfigured(settings), false);
});

test("keeps an already migrated repository URL", () => {
  const settings = load({
    githubRepoUrl: "https://github.example.com/owner/repo",
    githubOwner: "stale",
    githubRepo: "stale",
  });

  assert.equal(migrateSettings(settings), true);
  assert.equal(settings.githubRepoUrl, "https://github.example.com/owner/repo");
});

test("has nothing to migrate on a fresh install", () => {
  assert.equal(migrateSettings(load({})), false);
});
