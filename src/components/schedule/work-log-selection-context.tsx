"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type WorkLogSelectionContextValue = {
  selectedWorkLogId: string | null;
  editingNoteId: string | null;
  /** blur 저장을 건너뛸지 (다른 바 선택·바깥 클릭 등) */
  shouldDiscardNoteEdit: () => boolean;
  select: (workLogId: string) => void;
  clear: () => void;
  startEdit: (workLogId: string) => void;
  cancelEdit: () => void;
  /** 저장 직전 편집 종료 (Enter/blur 커밋용) */
  endEditIf: (workLogId: string) => boolean;
};

const WorkLogSelectionContext =
  createContext<WorkLogSelectionContextValue | null>(null);

/** 보드 전체에서 작업시간 간트바는 하나만 선택 */
export function WorkLogSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedWorkLogId, setSelectedWorkLogId] = useState<string | null>(
    null,
  );
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const discardNoteEditRef = useRef(false);
  const editingNoteIdRef = useRef<string | null>(null);
  editingNoteIdRef.current = editingNoteId;

  const shouldDiscardNoteEdit = useCallback(() => {
    if (!discardNoteEditRef.current) return false;
    discardNoteEditRef.current = false;
    return true;
  }, []);

  const select = useCallback((workLogId: string) => {
    if (editingNoteIdRef.current) discardNoteEditRef.current = true;
    setEditingNoteId(null);
    setSelectedWorkLogId(workLogId);
  }, []);

  const clear = useCallback(() => {
    if (editingNoteIdRef.current) discardNoteEditRef.current = true;
    setEditingNoteId(null);
    setSelectedWorkLogId(null);
  }, []);

  const startEdit = useCallback((workLogId: string) => {
    setSelectedWorkLogId(workLogId);
    setEditingNoteId(workLogId);
  }, []);

  const cancelEdit = useCallback(() => {
    discardNoteEditRef.current = true;
    setEditingNoteId(null);
  }, []);

  const endEditIf = useCallback((workLogId: string) => {
    if (editingNoteIdRef.current !== workLogId) return false;
    editingNoteIdRef.current = null;
    setEditingNoteId(null);
    return true;
  }, []);

  const value = useMemo(
    () => ({
      selectedWorkLogId,
      editingNoteId,
      shouldDiscardNoteEdit,
      select,
      clear,
      startEdit,
      cancelEdit,
      endEditIf,
    }),
    [
      selectedWorkLogId,
      editingNoteId,
      shouldDiscardNoteEdit,
      select,
      clear,
      startEdit,
      cancelEdit,
      endEditIf,
    ],
  );

  return (
    <WorkLogSelectionContext.Provider value={value}>
      {children}
    </WorkLogSelectionContext.Provider>
  );
}

export function useWorkLogSelection() {
  const ctx = useContext(WorkLogSelectionContext);
  if (!ctx) {
    throw new Error(
      "useWorkLogSelection must be used within WorkLogSelectionProvider",
    );
  }
  return ctx;
}
