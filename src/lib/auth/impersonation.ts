import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const IMPERSONATION_COOKIE_NAME = "kcc_admin_impersonation";
export const IMPERSONATION_MAX_AGE_SECONDS = 60 * 60 * 12;

export const IMPERSONATION_ALLOWED_EMAILS = new Set([
  "kawah.rds@gmail.com",
  "kikicreator1@gmail.com",
]);

export type ImpersonationRole = "instructor" | "member";

export type ImpersonationPayload = {
  version: 1;
  adminUserId: string;
  adminEmail: string;
  adminAccessToken: string;
  adminRefreshToken: string;
  targetUserId: string;
  targetName: string;
  targetEmail: string;
  targetRole: ImpersonationRole;
  expiresAt: number;
};

function getEncryptionKey() {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;

  if (!secret) {
    throw new Error("Kunci server untuk mode pengujian belum dikonfigurasi.");
  }

  return createHash("sha256")
    .update(`kiki-creator-class:admin-impersonation:${secret}`)
    .digest();
}

/**
 * Encrypts the administrator's original Supabase session before switching
 * to a real target-user session. The cookie is HttpOnly and authenticated
 * with AES-256-GCM so the browser cannot read or modify the saved session.
 */
export function encryptImpersonationPayload(
  payload: ImpersonationPayload,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptImpersonationPayload(
  value: string,
): ImpersonationPayload | null {
  try {
    const [ivPart, tagPart, encryptedPart] = value.split(".");
    if (!ivPart || !tagPart || !encryptedPart) return null;

    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivPart, "base64url"),
    );

    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64url")),
      decipher.final(),
    ]);

    const payload = JSON.parse(
      decrypted.toString("utf8"),
    ) as ImpersonationPayload;

    if (
      payload.version !== 1 ||
      !payload.adminUserId ||
      !payload.adminAccessToken ||
      !payload.adminRefreshToken ||
      !payload.targetUserId ||
      !payload.targetEmail ||
      !payload.targetName ||
      !["instructor", "member"].includes(payload.targetRole) ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
