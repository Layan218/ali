'use client';

type AuthLike = {
  signOut: () => Promise<void> | void;
};

export async function signOut(auth: AuthLike) {
  await auth.signOut();
}

