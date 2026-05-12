import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

type ServiceAccountShape = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

function getServiceAccount(): ServiceAccountShape | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    let parsed: {
      project_id?: string;
      client_email?: string;
      private_key?: string;
      projectId?: string;
      clientEmail?: string;
      privateKey?: string;
    };

    try {
      parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
      return null;
    }

    return {
      projectId: parsed.projectId ?? parsed.project_id,
      clientEmail: parsed.clientEmail ?? parsed.client_email,
      privateKey: parsed.privateKey ?? parsed.private_key
    };
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    };
  }

  return null;
}

export function getAdminApp(): App | null {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  const serviceAccount = getServiceAccount();
  if (!serviceAccount?.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    return null;
  }

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey
    })
  });
}

export function getAdminFirestore(): Firestore | null {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}
