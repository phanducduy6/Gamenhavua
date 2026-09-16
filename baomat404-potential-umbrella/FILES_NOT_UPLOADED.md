# Files not uploaded to GitHub

The following local files and folders are intentionally excluded by `.gitignore`:

- `.env` - local environment variables and secrets. Create it again after cloning.
- `node_modules/` - installed dependencies. Run `npm install` after cloning.

The repository also contains SSL certificate/key files under `ssl/`. They are tracked in Git, but private keys should be rotated and replaced with deployment-specific files if this repository is shared.