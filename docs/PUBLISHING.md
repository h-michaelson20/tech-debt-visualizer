# Publishing to npm

Follow these steps to publish **tech-debt-visualizer** to npm. You need an npm account (you have one).

---

## 1. Log in to npm (one time per machine)

In a terminal, from anywhere:

```bash
npm login
```

- **Username:** your npm username  
- **Password:** your npm password  
- **Email:** the email on your npm account  
- **OTP:** if you have 2FA, enter the code from your app

You should see: `Logged in as YOUR_USERNAME on https://registry.npmjs.org/`

---

## 2. Build the package

From the **project root** (`tech-debt-visualizer`):

```bash
npm run build
```

This compiles TypeScript to `dist/`. The `prepublishOnly` script will run this again automatically when you publish, but it’s good to confirm the build works first.

---

## 3. Publish

Still in the project root:

```bash
npm publish
```

- **First time:** npm will publish the package. Only `dist/` and `README.md` are included (see `files` in `package.json`).
- If you see **“402 Payment Required”** or a message about a paid plan: npm now requires a paid plan for new **unscoped** packages in some cases. If that happens, use a **scoped** name (step 4).
- If you see **“You must verify your email”**: Verify the email on your npm account at [npmjs.com](https://www.npmjs.com), then try again.

---

## 4. If you need a scoped package (e.g. name taken or 402)

If the name `tech-debt-visualizer` is taken or npm asks for payment:

1. **Use your npm username as scope.** Edit `package.json` and set:

   ```json
   "name": "@YOUR_NPM_USERNAME/tech-debt-visualizer"
   ```

   Replace `YOUR_NPM_USERNAME` with your actual npm username.

2. **Publish as public** (scoped packages are private by default):

   ```bash
   npm publish --access public
   ```

3. **Install / run** for users:

   ```bash
   npx @YOUR_NPM_USERNAME/tech-debt-visualizer analyze .
   ```

---

## 5. After publishing

- **Page:** `https://www.npmjs.com/package/tech-debt-visualizer` (or `.../package/@yourname/tech-debt-visualizer` if scoped).
- **Install:**
  - Unscoped: `npm install -g tech-debt-visualizer` or `npx tech-debt-visualizer analyze .`
  - Scoped: `npx @yourname/tech-debt-visualizer analyze .`

---

## Updating the package later

1. Bump the version in `package.json` (e.g. `"version": "0.1.1"`).
2. Run `npm run build`.
3. Run `npm publish` (or `npm publish --access public` if scoped).

Optional: use `npm version patch` to bump and create a git tag in one step.
