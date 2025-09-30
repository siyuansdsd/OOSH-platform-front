/**
 * Global API error handler for authentication errors
 * This helps ensure consistent handling of 401 errors across the application
 */

export function isAuthenticationError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("401") ||
      error.message.includes("invalid token") ||
      error.message.includes("Unauthorized")
    );
  }

  if (typeof error === "object" && error !== null && "status" in error) {
    return (error as { status: number }).status === 401;
  }

  return false;
}

export function createApiErrorHandler(handleAuthError: (error: unknown) => void) {
  return (error: unknown) => {
    if (isAuthenticationError(error)) {
      handleAuthError(error);
    }
    throw error; // Re-throw so caller can handle display logic
  };
}