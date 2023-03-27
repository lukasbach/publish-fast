import * as fs from "fs-extra";
import * as path from "path";
import { cyan, gray, green } from "colors";
import execa from "execa";
import prompts from "prompts";
import { bump, git, options } from "./index";

export const log = (message: string) => {
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
    stdout: "ignore",
    stderr: "inherit",
    ...opts.options,
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

  if (options.releaseNotesTemplate && !options.dryRun) {
    const template = await fs.readFile(options.releaseNotesTemplate, { encoding: "utf-8" });
    await fs.writeFile(options.releaseNotesSource, template, { encoding: "utf-8" });
    log(`> ~~Reset Release notes file~~`);
  }

  log(`> ~~Release notes~~`);
  log(releaseNotes);

  return releaseNotes;
};

export const bumpVersion = async () => {
  if (options.skipBump) {
    return;
  }

  log(`> ~~Bumping version~~`);
  await run({
    packageManager: "npm",
    arguments: {
      all: ["version", bump],
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

  return prompts({
    type: "password",
    name: "value",
    message: "Enter a Github Token to create the release.",
  });
};

export const loadPackageJson = async () => fs.readJSON(path.join(process.cwd(), "package.json"));

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

export const commitChanges = async version => {
  log(`> ~~Committing changes~~`);
  const msg = (options.commitMessage ?? "").replace("{version}", version);
  await git.add("./*");
  await git.addConfig("user.name", options.commitAuthor).addConfig("user.email", options.commitEmail).commit(msg);
};
