import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Signature = {
  id: string;
  title: string;
  body: string;
  accountId: string | null;
};

type SignatureState = {
  signatures: Signature[];
  defaultSignatureId: string | null;
  create: (signature: Omit<Signature, 'id'>) => string;
  update: (id: string, signature: Partial<Omit<Signature, 'id'>>) => void;
  delete: (id: string) => void;
  setDefault: (id: string | null) => void;
};

export const resolveSignatureForAccount = (
  signatures: Signature[],
  defaultSignatureId: string | null,
  accountId: string
) => {
  const defaultSignature = signatures.find((signature) => signature.id === defaultSignatureId) ?? null;

  if (defaultSignature?.accountId === null || defaultSignature?.accountId === accountId) {
    return defaultSignature;
  }

  return signatures.find((signature) => signature.accountId === accountId) ?? signatures.find((signature) => signature.accountId === null) ?? null;
};

const defaultSignature = {
  id: 'sig_default',
  title: 'Default signature',
  body: '<p>Best,<br />Leco</p>',
  accountId: null
} satisfies Signature;

export const useSignatureStore = create<SignatureState>()(
  persist(
    (set) => ({
      signatures: [defaultSignature],
      defaultSignatureId: defaultSignature.id,
      create: (signature) => {
        const id = `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({
          signatures: [...state.signatures, { ...signature, id }]
        }));
        return id;
      },
      update: (id, signature) =>
        set((state) => ({
          signatures: state.signatures.map((candidate) =>
            candidate.id === id ? { ...candidate, ...signature } : candidate
          )
        })),
      delete: (id) =>
        set((state) => {
          const signatures = state.signatures.filter((signature) => signature.id !== id);
          return {
            signatures,
            defaultSignatureId:
              state.defaultSignatureId === id ? signatures[0]?.id ?? null : state.defaultSignatureId
          };
        }),
      setDefault: (defaultSignatureId) => set({ defaultSignatureId })
    }),
    {
      name: 'open-mail-signatures'
    }
  )
);
