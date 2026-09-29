export const DASHBOARD_VIEW_IDS = ["overview", "mandate", "gate", "audit"] as const;

export type DashboardView = (typeof DASHBOARD_VIEW_IDS)[number];

export const MANDATE_STEP_IDS = ["asset", "limits", "simulation", "review"] as const;

export type MandateStepId = (typeof MANDATE_STEP_IDS)[number];

export function parseDashboardView(value: string | null | undefined): DashboardView {
  return DASHBOARD_VIEW_IDS.includes(value as DashboardView)
    ? value as DashboardView
    : "overview";
}

export function dashboardViewSearch(search: string, view: DashboardView): string {
  const params = new URLSearchParams(search);
  params.set("view", view);
  if (view !== "mandate") params.delete("step");
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function parseMandateStep(value: string | null | undefined): number {
  const index = MANDATE_STEP_IDS.indexOf(value as MandateStepId);
  return index < 0 ? 0 : index;
}

export function mandateStepSearch(search: string, step: number): string {
  const params = new URLSearchParams(search);
  params.set("view", "mandate");
  params.set("step", MANDATE_STEP_IDS[step] ?? MANDATE_STEP_IDS[0]);
  return `?${params.toString()}`;
}

export function canVisitMandateStep(step: number, validationErrorCount: number): boolean {
  return step < 2 || validationErrorCount === 0;
}
