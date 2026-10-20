// PA-REQ-03: shared by the request client and the operator verifier.
/** The operator PIN binds the document digest and metadata; the bytes travel only with the command itself. */
export function operatorBoundPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !Array.isArray((payload as { documents?: unknown }).documents)) return payload;
  const value = payload as Record<string, unknown> & { documents: unknown[] };
  return { ...value, documents: value.documents.map(item => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== "contentBase64")) : item) };
}
