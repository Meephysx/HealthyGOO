import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  onAuthStateChanged,
  signOut,
  updateProfile,
  User,
  ConfirmationResult,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

async function saveUserIfNotExists(user: User, provider = "email") {
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        phone: user.phoneNumber || "",
        provider,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error("saveUserIfNotExists", err);
    throw err;
  }
}

export async function registerWithEmail(name: string, email: string, password: string) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    // set display name
    await updateProfile(user, { displayName: name });
    // send verification email
    await sendEmailVerification(user);
    // save user record (do not assume verified)
    await saveUserIfNotExists(user, "email");
    return user;
  } catch (err) {
    console.error("registerWithEmail", err);
    throw err;
  }
}

export async function resendVerification(user: User) {
  try {
    await sendEmailVerification(user);
  } catch (err) {
    console.error("resendVerification", err);
    throw err;
  }
}

export async function loginWithEmail(email: string, password: string) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    // Note: For email+password, we don't enforce emailVerified check here
    // That's handled in Onboarding component
    await saveUserIfNotExists(user, "email");
    return user;
  } catch (err) {
    console.error("loginWithEmail", err);
    throw err;
  }
}

export function initRecaptcha(containerId = "recaptcha-container") {
  if (typeof window === "undefined") return null;
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(
      containerId,
      {
        size: "invisible",
      },
      auth
    );
  }
  return window.recaptchaVerifier;
}

export async function signInWithPhone(phone: string) {
  try {
    const verifier = initRecaptcha();
    if (!verifier) throw new Error("Recaptcha init failed");
    const confirmationResult: ConfirmationResult = await signInWithPhoneNumber(auth, phone, verifier);
    return confirmationResult;
  } catch (err) {
    console.error("signInWithPhone", err);
    throw err;
  }
}

export async function confirmPhone(confirmationResult: ConfirmationResult, code: string) {
  try {
    const cred = await confirmationResult.confirm(code);
    const user = cred.user;
    await saveUserIfNotExists(user, "phone");
    return user;
  } catch (err) {
    console.error("confirmPhone", err);
    throw err;
  }
}

export function observeAuth(callback: (u: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function logout() {
  await signOut(auth);
}

export default {
  registerWithEmail,
  resendVerification,
  loginWithEmail,
  signInWithPhone,
  confirmPhone,
  initRecaptcha,
  observeAuth,
  logout,
};
