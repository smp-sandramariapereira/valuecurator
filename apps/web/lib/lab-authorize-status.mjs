export function labAuthorizeHttpStatus(result) {
  const status = result?.status;
  if (status === 400 || status === 413 || status === 429) return status;
  if (result?.decision === "ERROR") return 503;
  return 200;
}
