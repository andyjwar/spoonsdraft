/**
 * Per-site dashboard sections (baked in at `vite build`).
 * Set in GitHub: Settings → Secrets and variables → Actions → Variables
 * (or Environment variables on `github-pages`), same as VITE_FPL_PROXY_URL.
 *
 * Omit or leave empty for defaults (all sections on — TCLOT / ExFOS).
 * EAGalaxy example: VITE_SHOW_DASHBOARD_TRADES=false, VITE_SHOW_DASHBOARD_HALL=false
 */
function readBoolEnv(value, defaultTrue = true) {
  if (value === undefined || value === '') return defaultTrue
  const s = String(value).toLowerCase().trim()
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true
  return defaultTrue
}

export const showDashboardTrades = readBoolEnv(
  import.meta.env.VITE_SHOW_DASHBOARD_TRADES,
  true,
)
export const showDashboardHall = readBoolEnv(
  import.meta.env.VITE_SHOW_DASHBOARD_HALL,
  true,
)
