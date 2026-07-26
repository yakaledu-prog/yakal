import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface TopbarActionsCtx {
  actions: ReactNode | null;
  setActions: (actions: ReactNode | null) => void;
}

const Ctx = createContext<TopbarActionsCtx>({ actions: null, setActions: () => {} });

export function TopbarActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode | null>(null);
  return <Ctx.Provider value={{ actions, setActions }}>{children}</Ctx.Provider>;
}

export function useTopbarActionsContext() {
  return useContext(Ctx);
}

/** Mounts the given actions to the topbar while the component is mounted. */
export function useTopbarActions(actions: ReactNode | null) {
  const { setActions } = useContext(Ctx);
  
  useEffect(() => {
    setActions(actions);
    return () => setActions(null);
  }, [actions, setActions]);
}
