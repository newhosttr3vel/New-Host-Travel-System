type ReservationTransactionResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: Response };

export async function runReservationTransaction<T>(
  operation: string,
  run: () => Promise<T>,
): Promise<ReservationTransactionResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    const candidate = error && typeof error === "object"
      ? error as { name?: unknown; code?: unknown; message?: unknown }
      : null;
    const name = typeof candidate?.name === "string" ? candidate.name : "UnknownError";
    const code = typeof candidate?.code === "string" ? candidate.code : undefined;
    const message = error instanceof Error
      ? error.message.slice(0, 900)
      : String(error).slice(0, 900);

    // Keep the full exception in the Codespaces server log for diagnosis.
    console.error(`[reservation:${operation}] database transaction failed`, error);

    // Detailed database diagnostics are available only in development.
    return {
      ok: false,
      response: Response.json({
        error: "RESERVATION_SAVE_FAILED",
        ...(process.env.NODE_ENV !== "production"
          ? { debug: { name, ...(code ? { code } : {}), message } }
          : {}),
      }, { status: 500 }),
    };
  }
}
