import { createContext, useCallback, useContext, useEffect, useState } from "react";

type LabelMap = Record<string, string>;

interface BreadcrumbCtx {
  labels: LabelMap;
  setLabel: (segment: string, label: string) => void;
  clearLabel: (segment: string) => void;
}

const Ctx = createContext<BreadcrumbCtx>({ labels: {}, setLabel: () => {}, clearLabel: () => {} });

/** Lets pages give a friendly breadcrumb label to a URL segment (e.g. a course id). */
export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = useState<LabelMap>({});
  const setLabel = useCallback((segment: string, label: string) => {
    setLabels((prev) => (prev[segment] === label ? prev : { ...prev, [segment]: label }));
  }, []);
  const clearLabel = useCallback((segment: string) => {
    setLabels((prev) => {
      if (!(segment in prev)) return prev;
      const next = { ...prev };
      delete next[segment];
      return next;
    });
  }, []);
  return <Ctx.Provider value={{ labels, setLabel, clearLabel }}>{children}</Ctx.Provider>;
}

export function useBreadcrumbLabels() {
  return useContext(Ctx).labels;
}

/** Register a breadcrumb label for a segment while this component is mounted. */
export function useSetBreadcrumb(segment?: string, label?: string) {
  const { setLabel, clearLabel } = useContext(Ctx);
  useEffect(() => {
    if (!segment || !label) return;
    setLabel(segment, label);
    return () => clearLabel(segment);
  }, [segment, label, setLabel, clearLabel]);
}
