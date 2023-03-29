import * as fs from "fs-extra";
import * as path from "path";
import { cyan, gray, green } from "colors";
import execa from "execa";
import prompts from "prompts";
import { Octokit } from "@octokit/rest";
import mime from "mime";
import { glob } from "glob";
import { inc } from "semver";
import { git, options } from "./index";
import { Bump } from "./types";

export const log = (message: string) => {
  // eslint-disable-next-line no-console
  console.log(
    message
      .replace(/\*\*(.*?)\*\*/g, cyan("$1"))
      .replace(/__(.*?)__/g, gray("$1"))
      .replace(/~~(.*?)~~/g, green("$1"))
  );
};

export const verbose = (message: string) => {
  if (options.verbose) {
    log(message);
  }
};

export const run = async (opts: {
  packageManager: string;
  skipOnDry?: boolean;
  arguments: Record<string, string[]>;
  options?: execa.Options;
}) => {
  if ((opts.skipOnDry ?? true) && options.dryRun) {
    log(
      `**Skipping command:** __${opts.packageManager} ${
        opts.arguments[opts.packageManager] ?? opts.arguments.all.join(" ")
      }__`
    );
    return;
  }
  await execa(opts.packageManager, opts.arguments[opts.packageManager] ?? opts.arguments.all ?? opts.arguments.npm, {
    stdout: options.pipeStdout ? "inherit" : "ignore",
    stderr: "inherit",
    ...opts.options,
  });
};

export const promptBump = async (currentVersion) => {
  return prompts({
    type: "select",
    name: "bumpType",
    message: "Choose which new version to release",
    choices: [Bump.Patch, Bump.Minor, Bump.Major, Bump.PrePatch, Bump.PreMinor, Bump.PreMajor, Bump.Prerelease].map(
      (bump) => ({
        title: `${bump} (${currentVersion} -> ${inc(currentVersion, bump)})`,
        value: bump,
      })
    ),
  });
};

export const getPackageManager = () => {
  if (options.packageManager && options.packageManager !== "auto") {
    return options.packageManager;
  }

  if (fs.existsSync(path.join(process.cwd(), "yarn.lock"))) {
    return "yarn";
  }

  if (fs.existsSync(path.join(process.cwd(), "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  return "npm";
};

export const installDeps = async (packageManager: string) => {
  if (options.skipInstall) {
    return;
  }
  log(`> ~~Installing dependencies~~`);

  await run({
    packageManager,
    arguments: { all: ["install"] },
  });
};

export const preScripts = async (packageManager: string) => {
  const scripts = (options.preScripts || "").split(",").filter(Boolean);
  for (const script of scripts) {
    log(`> ~~Running pre script: ${script}~~`);
    await run({
      packageManager,
      arguments: { all: ["run", script] },
    });
  }
};

export const loadReleaseNotes = async () => {
  if (!options.releaseNotesSource) {
    log(`No release notes source provided, using empty string.`);
    return "";
  }

  const releaseNotes = await fs.readFile(options.releaseNotesSource, { encoding: "utf-8" });

  if (!options.dryRun) {
    log(`> ~~Reset Release notes file~~`);
    const template = options.releaseNotesTemplate
      ? await fs.readFile(options.releaseNotesTemplate, { encoding: "utf-8" })
      : "";
    await fs.writeFile(options.releaseNotesSource, template, { encoding: "utf-8" });
  }

  log(`> ~~Release notes~~`);
  log(releaseNotes || "(empty)");

  return releaseNotes;
};

export const updateChangelog = async (opts: {
  releaseNotes: string;
  oldVersion: string;
  newVersion: string;
  repo: string;
  owner: string;
}) => {
  if (!options.changelog) {
    return;
  }

  const changelogPath = path.join(process.cwd(), options.changelog);

  if (!fs.existsSync(changelogPath)) {
    log(`Changelog file does not exist, skipping updating the Changelog.`);
  }

  if (options.dryRun) {
    log(`> ~~Skipping updating the Changelog~~`);
    return;
  }

  log(`> ~~Updating the Changelog~~`);

  const changelog = await fs.readFile(changelogPath, { encoding: "utf-8" });
  const title = `## [${opts.newVersion}](https://github.com/${opts.owner}/${opts.repo}/compare/${opts.oldVersion}...${
    opts.newVersion
  }) (${new Date().toISOString().split("T")[0]})`;
  const newChangelog = `${title}\n\n${opts.releaseNotes}\n\n\n${changelog}`;

  await fs.writeFile(changelogPath, newChangelog, { encoding: "utf-8" });
};

export const bumpVersion = async (bump: Bump) => {
  if (options.skipBump) {
    return;
  }

  log(`> ~~Bumping version~~`);
  await run({
    packageManager: "npm",
    arguments: {
      all: ["version", bump, "--git-tag-version false", "-no-git-tag-version", "--commit-hooks false"],
    },
  });
};

export const npmPublish = async () => {
  if (options.skipPublish) {
    return;
  }

  log(`> ~~Publishing package~~`);
  await run({
    packageManager: "npm",
    skipOnDry: false,
    arguments: {
      all: [
        "publish",
        options.dryRun ? "--dry-run" : null,
        options.npmAccess ? `--access ${options.npmAccess}` : null,
        `--tag ${options.npmTag}`,
      ].filter<string>(Boolean as any),
    },
  });
};

export const getGithubToken = async () => {
  if (options.skipGithubRelease) {
    return "";
  }

  if (options.githubToken) {
    log(`Using github token from passed option.`);
    return options.githubToken;
  }

  if (process.env.GITHUB_TOKEN) {
    log(`Using github token from environment.`);
    return process.env.GITHUB_TOKEN;
  }

  if (process.env.ci) {
    log(`No github token provided.`);
    process.exit(1);
  }

  try {
    const { stdout } = await execa("gh", ["auth", "token"]);
    log(`Using github token inferred from local GH CLI installation.`);
    return stdout;
    // eslint-disable-next-line no-empty
  } catch (e) {}

  if (options.dryRun) {
    log(`No github token provided. During non-dry-run, this will be asked interactively.`);
    return "";
  }

  const token = await prompts({
    type: "password",
    name: "value",
    message: "Enter a Github Token to create the release.",
  });
  return token.value;
};

export const verifyGithubToken = async (token: string) => {
  const kit = new Octokit({ auth: token });
  const { headers } = await kit.request("GET /user");
  const scopes = headers["x-oauth-scopes"]?.split(", ") ?? [];
  if (!scopes.includes("repo")) {
    log(`The provided Github token does not have the "repo" scope.`);
    process.exit(1);
  }
};

export const loadPackageJson = () => fs.readJSONSync(path.join(process.cwd(), "package.json"));
export const loadReleaseConfig = () => {
  const configPath = path.join(process.cwd(), ".publishrc.json");
  if (!fs.existsSync(configPath)) {
    return {};
  }
  return fs.readJSONSync(configPath);
};

export const getRepoUrl = async (packageJson: any) => {
  if (packageJson.repository && typeof packageJson.repository === "string") {
    return packageJson.repository;
  }
  const origin = (await git.getConfig("remote.origin.url")).value;
  if (!origin) {
    log(`No repository url found in package.json or as git origin.`);
    process.exit(1);
  }

  return origin;
};

export const getGithubRepoAndUser = async (packageJson: any) => {
  const repoUrl = await getRepoUrl(packageJson);
  const result = /github\.com\/(.*?)\/(.*?)(?:\.git)?$/i.exec(repoUrl);
  if (!result) {
    log(`Could not parse repository url: ${repoUrl}`);
    process.exit(1);
  }
  return {
    repoUser: result[1],
    repoName: result[2],
  };
};

export const verifyNoUncommittedChanges = async () => {
  const { isClean } = await git.status();
  if (!isClean()) {
    log(`There are uncommitted changes. Please commit or stash them before running this command.`);
    process.exit(1);
  }
  log(`__No uncommitted changes__`);
};

export const verifyBranch = async () => {
  if (!options.branch) {
    return;
  }

  const { current } = await git.branch();
  if (current !== options.branch) {
    log(`You are not on the ${options.branch} branch. Please switch to the main branch before running this command.`);
    process.exit(1);
  }
  log(`__Releasing from branch__ ${current}`);
};

export const commitChanges = async (version) => {
  if (options.skipCommit) {
    return;
  }

  log(`> ~~Committing changes~~`);

  const msg = (options.commitMessage ?? "").replace("{version}", version);

  if (options.dryRun) {
    log(
      `**Skipping git commit with message** __${msg}__ from __${options.commitAuthor ?? "default"} <${
        options.commitEmail ?? "default"
      }>__`
    );
    return;
  }

  await git.add("./*");

  if (options.commitAuthor) {
    await git.addConfig("user.name", options.commitAuthor);
  }
  if (options.commitEmail) {
    await git.addConfig("user.email", options.commitEmail);
  }
  await git.commit(msg);
};

export const createTag = async (version) => {
  if (options.skipCommit) {
    return;
  }

  log(`> ~~Creating tag~~`);

  if (options.dryRun) {
    log(`**Skipping creating a tag** __v${version}__`);
    return;
  }

  await git.addTag(`v${version}`);
};

export const pushChanges = async () => {
  if (options.skipPush) {
    return;
  }

  log(`> ~~Pushing changes~~`);

  if (options.dryRun) {
    log(`**Skipping pushing changes and tags**`);
    return;
  }

  const { current } = await git.branch();
  await git.push("origin", current);
  await git.pushTags("origin");
};

export const createGithubRelease = async (opts: {
  token: string;
  version: string;
  releaseNotes: string;
  owner: string;
  repo: string;
}) => {
  if (options.skipGithubRelease) {
    return null;
  }

  log(`> ~~Creating Github Release~~`);

  const { current } = await git.branch();

  const release = {
    owner: opts.owner,
    repo: opts.repo,
    tag_name: `v${opts.version}`,
    name: `v${opts.version}`,
    target_commitish: current,
    draft: options.draftRelease,
    make_latest: "true",
  } as const;

  if (options.dryRun) {
    log(`**Skipping creating github release**`);
    log(`**Github release data:**\n${JSON.stringify(release, null, 2)}`);
    return null;
  }

  const kit = new Octokit({
    auth: opts.token,
  });
  const response = await kit.repos.createRelease({ ...release, body: opts.releaseNotes });
  log(`__Github Release created__ ${response.data.html_url}`);
  return response.data.id;
};

export const uploadReleaseAsset = async (opts: {
  token: string;
  owner: string;
  repo: string;
  releaseId: number;
  file: string;
}) => {
  if (options.dryRun) {
    log(`**Skipping asset upload of ${opts.file}**`);
    return;
  }

  log(`> ~~Uploading~~ __${opts.file}__`);

  const kit = new Octokit({
    auth: opts.token,
  });
  const data = (await fs.readFile(opts.file)) as unknown as string;
  const mediaType = mime.getType(opts.file);

  if (!mediaType) {
    log(`**Skipping asset upload of ${opts.file} because mime type is unknown**`);
  }

  await kit.repos.uploadReleaseAsset({
    owner: opts.owner,
    repo: opts.repo,
    data,
    release_id: opts.releaseId,
    name: path.basename(opts.file),
    headers: {
      "content-type": mediaType!,
      "content-length": fs.statSync(opts.file).size,
    },
  });
};

export const uploadReleaseAssets = async (opts: {
  token: string;
  owner: string;
  repo: string;
  releaseId: number | null;
}) => {
  if (!options.releaseAssets) {
    return;
  }

  if (!opts.releaseId && !options.dryRun) {
    log(`**Skipping uploading assets because github release didn't properly return.**`);
    return;
  }

  const assets = await glob(options.releaseAssets);

  if (options.skipGithubRelease) {
    log(`**Skipping uploading ${assets.length} because github release is skipped.**`);
  }

  log(`Found ${assets.length} assets to upload`);
  for (const asset of assets) {
    await uploadReleaseAsset({ ...opts, releaseId: opts.releaseId!, file: asset });
  }
};
