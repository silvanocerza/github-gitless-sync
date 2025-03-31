import * as fs from "fs";
import * as proxyquire from "proxyquire";
import * as obsidianMocks from "./mock-obsidian";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import { execSync } from "child_process";

const proxyquireNonStrict = proxyquire.noCallThru();

const LoggerModule = proxyquireNonStrict("./src/logger", {
  obsidian: obsidianMocks,
});

const GithubClientModule = proxyquireNonStrict("./src/github/client", {
  obsidian: obsidianMocks,
});

const MetadataStoreModule = proxyquireNonStrict("./src/metadata-store", {
  obsidian: obsidianMocks,
});

const EventsListenerModule = proxyquireNonStrict("./src/events-listener", {
  obsidian: obsidianMocks,
  "./metadata-store": MetadataStoreModule,
});

const UtilsModule = proxyquireNonStrict("./src/utils", {
  obsidian: obsidianMocks,
});

const SyncManagerModule = proxyquireNonStrict("./src/sync-manager", {
  obsidian: obsidianMocks,
  "./metadata-store": MetadataStoreModule,
  "./events-listener": EventsListenerModule,
  "./github/client": GithubClientModule,
  "./utils": UtilsModule,
});

async function runBenchmark(vaultRootDir: string) {
  const vault = new obsidianMocks.Vault(vaultRootDir);
  console.log("Vault config dir:", vault.configDir);

  // Create a real logger with our mock vault
  const logger = new LoggerModule.default(vault, false);

  // Settings for the sync manager
  const settings = {
    githubToken: process.env.GITHUB_TOKEN,
    githubOwner: process.env.REPO_OWNER,
    githubRepo: process.env.REPO_NAME,
    githubBranch: process.env.REPO_BRANCH,
    syncConfigDir: false,
  };

  // We're not going to get any conflicts, this is useless
  const onConflicts = async () => {
    return [];
  };

  // Create the sync manager
  const SyncManager = SyncManagerModule.default;
  const syncManager = new SyncManager(vault, settings, onConflicts, logger);
  await syncManager.loadMetadata();

  const startTime = performance.now();
  await syncManager.firstSync();
  return performance.now() - startTime;
}

const generateRandomFiles = (
  rootPath: string,
  numFiles: number,
  maxDepth: number,
  maxTotalSize: number,
) => {
  const metadata: { lastSync: number; files: { [key: string]: {} } } = {
    lastSync: 0,
    files: {},
  };

  // Create root directory if it doesn't exist
  if (!fs.existsSync(rootPath)) {
    fs.mkdirSync(rootPath, { recursive: true });
  }

  // Generate folder structure first
  const allFolderPaths = [rootPath];

  for (let depth = 1; depth <= maxDepth; depth++) {
    const numFoldersAtThisDepth = Math.floor(Math.random() * 3) + 1; // 1-3 folders per level

    for (let i = 0; i < numFoldersAtThisDepth; i++) {
      const parentPath =
        allFolderPaths[Math.floor(Math.random() * allFolderPaths.length)];
      const currentDepthOfParent =
        parentPath.split(path.sep).length - rootPath.split(path.sep).length;

      // Only create subfolders if we haven't reached max depth for this path
      if (currentDepthOfParent < maxDepth) {
        const folderName = crypto.randomBytes(5).toString("hex");
        const newFolderPath = path.join(parentPath, folderName);

        fs.mkdirSync(newFolderPath, { recursive: true });
        allFolderPaths.push(newFolderPath);
      }
    }
  }

  // Now generate files
  let totalSize = 0;
  // Calculate approximate size per file to ensure we create all files
  const targetSizePerFile = Math.floor(maxTotalSize / numFiles);

  for (let i = 0; i < numFiles; i++) {
    // Pick a random folder to place the file in
    const targetFolder =
      allFolderPaths[Math.floor(Math.random() * allFolderPaths.length)];

    // Generate random file name
    const fileName = crypto.randomBytes(8).toString("hex") + ".md";
    const filePath = path.join(targetFolder, fileName);

    // Calculate remaining size and files
    const remainingSize = maxTotalSize - totalSize;
    const remainingFiles = numFiles - i;

    if (remainingSize <= 0) {
      // If we've hit the max size but still need files, create empty files
      fs.writeFileSync(filePath, "");
    } else {
      // Calculate appropriate file size to ensure we can create all files
      const maxPossibleSize = Math.floor(remainingSize / remainingFiles);
      const contentSize =
        Math.floor(
          Math.random() * Math.min(maxPossibleSize, targetSizePerFile),
        ) + 1;

      // Generate random content
      const content = crypto.randomBytes(contentSize).toString("hex");

      // Write file
      fs.writeFileSync(filePath, content);
      totalSize += contentSize;
    }

    const relativeFilePath = filePath.replace(`${rootPath}/`, "");
    metadata.files[relativeFilePath] = {
      path: relativeFilePath,
      sha: null,
      dirty: true,
      justDownloaded: false,
      lastModified: Date.now(),
    };
  }

  const metadataFilePath = path.join(
    rootPath,
    ".obsidian",
    "github-sync-metadata.json",
  );
  fs.mkdirSync(path.join(rootPath, ".obsidian"));
  fs.writeFileSync(metadataFilePath, JSON.stringify(metadata), { flag: "w" });

  return totalSize;
};

const cleanupRemote = async () => {
  const url = `git@github.com:${process.env.REPO_OWNER}/${process.env.REPO_NAME}.git`;
  const clonedDir = path.join(os.tmpdir(), "temp-clone");

  try {
    // Clone the repository
    execSync(`git clone ${url} ${clonedDir}`, { stdio: "ignore" });

    // Remove all files except .git
    execSync('find . -type f -not -path "./.git*" -delete', {
      stdio: "ignore",
      cwd: clonedDir,
    });

    // Commit empty state
    execSync("git add -A", { stdio: "ignore", cwd: clonedDir });
    execSync('git commit -m "Cleanup"', {
      stdio: "ignore",
      cwd: clonedDir,
    });

    // Push changes
    execSync("git push", { stdio: "ignore", cwd: clonedDir });

    // Remove the folder
    fs.rm(clonedDir, { recursive: true, force: true }, (err) => {
      if (err) {
        throw err;
      }
    });
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
};

const BENCHMARK_DATA = [
  {
    files: 1,
    maxDepth: 1,
    maxSize: 7000,
  },
];

(async () => {
  const tmp = os.tmpdir();
  const benchmarkRootDir = path.join(tmp, "github-gitless-sync-benchmark");
  try {
    const results = [];
    for (const data of BENCHMARK_DATA) {
      const vaultRootDir = path.join(
        benchmarkRootDir,
        `${data.files}-${data.maxDepth}-${data.maxSize}`,
      );
      // Generates random files
      generateRandomFiles(
        vaultRootDir,
        data.files,
        data.maxDepth,
        data.maxSize,
      );

      // Run first sync by uploading all local files
      const uploadTime = await runBenchmark(vaultRootDir);

      // Cleanup vault dir completely
      fs.rmSync(vaultRootDir, { recursive: true, force: true });

      // Run first sync again, this time we download the files we just uploaded
      const downloadTime = await runBenchmark(vaultRootDir);

      // Cleanup the remote repo so it's ready for another benchmark
      await cleanupRemote();

      results.push({
        data,
        uploadTime,
        downloadTime,
      });
    }
    fs.writeFileSync("benchmark_result.json", JSON.stringify(results), {
      flag: "w",
    });
  } catch (error) {
    console.error("Benchmark failed:", error);
  }
  fs.rm(benchmarkRootDir, { recursive: true, force: true }, (err) => {
    if (err) {
      throw err;
    }
  });
})();
