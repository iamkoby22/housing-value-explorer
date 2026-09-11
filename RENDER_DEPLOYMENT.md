# Render deployment

The production architecture is a free Render Static Site for the browser application plus one `1c-2g` Python Web Service for XGBoost inference and exact TreeSHAP. The two services are declared in `render.yaml`. No database, persistent disk, worker, notebook, training matrix, or raw ACS file is required.

## 1. Connect GitHub

1. Push the reviewed repository to its GitHub `main` branch.
2. In Render, connect the GitHub account and grant access to this repository.
3. Confirm the GitHub Actions **Quality gate** passes. Both Render services use `autoDeployTrigger: checksPass`.

## 2. Create the Blueprint

1. Choose **New > Blueprint** in Render.
2. Select the repository and the root `render.yaml`.
3. Review the two proposed services:
   - `housing-value-explorer`: Static Site, `dist/client` publish directory.
   - `housing-value-explorer-api`: Python Web Service, `1c-2g`, `/health` readiness check.
4. Do not add a database or disk.

## 3. Enter environment variables

During initial Blueprint creation, enter:

- Static Site `NEXT_PUBLIC_INFERENCE_API_URL`: the API's full HTTPS URL, for example `https://housing-value-explorer-api.onrender.com`.
- API `HOUSING_ALLOWED_ORIGINS`: the exact frontend origin, for example `https://housing-value-explorer.onrender.com`. Add a future custom frontend origin with a comma and no path.

The Blueprint already fixes the API to one numerical thread with `HOUSING_NUM_THREADS`, `OMP_NUM_THREADS`, `OPENBLAS_NUM_THREADS`, `MKL_NUM_THREADS`, and `NUMEXPR_NUM_THREADS`. Render supplies `PORT`; the application binds it on `0.0.0.0`. Never put credentials in these public configuration values.

## 4. Deploy and verify the API

1. Allow the API build to install `requirements-inference.txt` and start `python inference/valuation_service.py`.
2. Open `https://<api-host>/health`. Require HTTP 200, `status: ok`, and every component value `true`.
3. Confirm `/docs` is unavailable, `GET /predict` returns 405, and invalid JSON produces a clean 400 response.

## 5. Deploy and verify the frontend

1. Allow the Static Site build to run `npm ci && npm run build`.
2. Open its temporary `onrender.com` URL and visit Overview, Explore, Estimate, Drivers, Model, and Research.
3. Submit an authoritative Estimate profile. Confirm the estimate, local context, all 18 SHAP rows, additivity verification, and scenarios match the local regression fixture behavior.
4. If CORS blocks the request, correct `HOUSING_ALLOWED_ORIGINS` on the API and redeploy it; do not use `*`.

## 6. Custom domains later

After temporary-domain verification, add the chosen frontend domain to the Static Site and, if desired, a separate API subdomain to the Web Service. Update `NEXT_PUBLIC_INFERENCE_API_URL` to the API's HTTPS custom URL and add the frontend custom origin to `HOUSING_ALLOWED_ORIGINS`, then redeploy both services. Configure DNS only from Render's displayed records; no real domain is assumed here.

## 7. Rollback

1. In each Render service, select **Deploys** and redeploy the last known-good commit.
2. Roll back the API and frontend together whenever the response schema or API URL changed.
3. Verify `/health`, then run the authoritative production prediction again.
4. If needed, disable auto-deploy temporarily while correcting configuration; do not rebuild or retrain the model as a rollback action.

## Local development

Local behavior is unchanged:

```powershell
npm ci
python -m pip install -r requirements-inference.txt -r requirements-test.txt
npm run dev
```

The frontend defaults to the local API at `http://127.0.0.1:8765`; Render-specific variables are not needed locally.
