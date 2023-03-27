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

    Usage: npx publish-fast [options]

    Options:
    -V, --version            output the version number
    -s, --small              small pizza size
    -p, --pizza-type <type>  flavour of pizza
    -h, --help               display help for command

## How to develop

- `yarn` to install dependencies
- `yarn start` to run in dev mode
- `yarn test` to run tests
- `yarn lint` to test and fix linter errors

To publish a new version, the publish pipeline can be manually
invoked.
