export interface UserPublicMetadata {
  role?: "admin" | "user";
}

declare global {
  interface ClerkAuthorization {
    role?: "admin" | "user";
  }
}

/**
 * Session claims shape when the session token is customized to include
 * `"metadata": "{{user.public_metadata}}"`.
 */
export interface CustomSessionClaims {
  metadata?: UserPublicMetadata;
}
