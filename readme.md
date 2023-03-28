# Publish Fast

> A straight forward tool for streamlining the publishing of NPM packages without a lot of setup and work

![Verify](https://github.com/lukasbach/publish-fast/workflows/verify/badge.svg)
![Publish](https://github.com/lukasbach/publish-fast/workflows/publish/badge.svg)

## How to use

Install globally via

    npm install -g publish-fast

or directly use via

    npx publish-fast

TODO You can also [download a prebuilt binary](https://github.com/lukasbach/publish-fast/releases) and run that.

Usage:
    Usage: publish-fast [options] [bump]
    
    Options:
      -V, --version                                      output the version number
      --verbose                                          verbose output (default: false)
      --dry-run                                          dry run (default: false)
      --package-manager <package-manager>                package manager, detected from lock file by default (default:
      "auto")
      --pre-scripts <pre-scripts>                        pre scripts seperated by commas (e.g. lint,test) (default:
      "lint,test")
      --commit-message <commit-message>                  new version commit message (default: "chore(release): {version}")
      --commit-author <commit-author>                    new version commit author
      --commit-email <commit-email>                      new version commit email
      --branch <branch>                                  release branch, for verification (default: "main")
      --release-notes-source <release-notes-source>      path to release notes source markdown file. Leave empty to use
      empty release notes.
      --release-notes-template <release-notes-template>  path to release notes template markdown file. Leave empty to not
      recreate the file after publishing.
      --changelog <changelog>                            path to changelog file. Leave empty to not update changelog. Will
      automatically be skipped if file doesn't exist. (default:
      "CHANGELOG.md")
      --github-token <github-token>                      github token for creating github release. If not provided, CLI
      will attempt to load through gh CLI, or alternatively
      interactively ask.
      --draft-release                                    create github release as draft (default: false)
      --npm-tag <npm-tag>                                npm tag to publish to (default: "latest")
      --npm-access <npm-access>                          npm access level
      --otp <npm-otp>                                    npm otp code
      --skip-install                                     skip installing dependencies (default: false)
      --skip-github-release                              skip creating github release (default: false)
      --skip-publish                                     skip publishing to npm (default: false)
      --skip-bump                                        skip bumping version (default: false)
      --skip-push                                        skip pushing changes (default: false)
      --skip-commit                                      skip committing changes (default: false)
      -h, --help                                         display help for command

## How to develop

- `yarn` to install dependencies
- `yarn start` to run in dev mode
- `yarn test` to run tests
- `yarn lint` to test and fix linter errors

To publish a new version, the publish pipeline can be manually
invoked.
