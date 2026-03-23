"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BirthdayBuilderAuthModal } from "../components/BirthdayBuilderAuthModal";

type BirthdayBuilderAuthContextValue = {
  openAuthModal: () => void;
  closeAuthModal: () => void;
  authModalOpen: boolean;
};

const BirthdayBuilderAuthContext = createContext<BirthdayBuilderAuthContextValue | null>(
  null,
);

export function BirthdayBuilderAuthProvider({ children }: { children: ReactNode }) {
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const openAuthModal = useCallback(() => {
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      openAuthModal,
      closeAuthModal,
      authModalOpen,
    }),
    [openAuthModal, closeAuthModal, authModalOpen],
  );

  return (
    <BirthdayBuilderAuthContext.Provider value={value}>
      {children}
      <BirthdayBuilderAuthModal
        open={authModalOpen}
        onOpenChange={(open) => {
          setAuthModalOpen(open);
        }}
      />
    </BirthdayBuilderAuthContext.Provider>
  );
}

export function useBirthdayBuilderAuth() {
  const ctx = useContext(BirthdayBuilderAuthContext);
  if (!ctx) {
    throw new Error("useBirthdayBuilderAuth must be used within BirthdayBuilderAuthProvider");
  }
  return ctx;
}
