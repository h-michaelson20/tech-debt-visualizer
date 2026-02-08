# Using an npm token to publish

If you have an **npm access token** (from npm.com → Profile → Access Tokens), you can use it instead of logging in with 2FA each time.

## One-time setup

**Option A — add token to your user config (recommended)**

In a terminal, run (replace `YOUR_TOKEN_HERE` with your actual token):

```bash
npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN_HERE
```

This writes the token to `~/.npmrc`. npm will use it for all publish/install-from-private when talking to registry.npmjs.org.

**Option B — environment variable (e.g. for CI)**

```bash
export NPM_TOKEN=your_token_here
echo "//registry.npmjs.org/:_authToken=\${NPM_TOKEN}" >> .npmrc
```

Never commit `.npmrc` if it contains the token. Add `.npmrc` to `.gitignore` if the file is in the project.

## Publish

From the project root:

```bash
npm publish
```

No browser login or OTP—the token authenticates you.

## Security

- **Do not** put the token in the repo or in a file that gets committed.
- Keep it in `~/.npmrc` (user-level) or in a CI secret.
- If the token is leaked, revoke it at https://www.npmjs.com/settings/~/tokens and create a new one.
