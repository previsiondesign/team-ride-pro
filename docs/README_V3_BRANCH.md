# v3-dev branch — redirect only (do not develop here)

**The live site is served from the `main` branch only.**

- **Live app URL:** https://previsiondesign.github.io/team-ride-pro/teamridepro_v3.html  
- **To update the site:** Edit files, commit, and **push to `main`**. No merges from v3-dev needed.

The **v3-dev** branch is **not** used for deployment. It exists so that the redirect path continues to work:

- **Redirect path:** `https://previsiondesign.github.io/team-ride-pro/v3/teamridepro_v3.html`  
- **Redirect target:** `https://previsiondesign.github.io/team-ride-pro/teamridepro_v3.html` (live app)

The redirect files live in the **`v3/`** folder **on `main`** (e.g. `v3/teamridepro_v3.html`, `v3/index.html`). They are not served from the v3-dev branch.

**Do not push app updates to v3-dev.** All development and deployment = **main** only.
