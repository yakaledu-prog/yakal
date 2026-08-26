import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

/**
 * When this person last opened a screen, so it can say what is new.
 *
 * The count in the sidebar says how many; this says which. Both need a
 * timestamp, and doing it in the browser alone does not work: a value kept only
 * in memory never survives a reload, and one written on render clears whether
 * or not anybody read anything.
 *
 * The mark is deliberately late. Reading the previous value first and writing
 * the new one after means the rows on screen stay bold for this visit, and are
 * not bold on the next one. Marking on arrival would clear the highlight
 * before the eye reached it.
 */
export function useSeen(surface: string) {
  const { user } = useAuth();
  const userId = user?.id;

  const { data: seenAt = null, isFetched } = useQuery({
    queryKey: ["seen", userId, surface],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_seen")
        .select("seen_at")
        .eq("user_id", userId!)
        .eq("surface", surface)
        .maybeSingle();
      return (data?.seen_at as string | null) ?? null;
    },
    enabled: !!userId,
    // Once per visit. Refetching would replace the value mid-visit with the one
    // this hook just wrote, and everything would stop being new while looked at.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!userId || !isFetched) return;
    void supabase
      .from("user_seen")
      .upsert({ user_id: userId, surface, seen_at: new Date().toISOString() }, { onConflict: "user_id,surface" })
      .then(({ error }) => {
        // Nothing to do about it. Failing to record a visit means a row stays
        // bold one visit longer, which is not worth surfacing to anybody.
        if (error) console.error("useSeen: could not record the visit:", error.message);
      });
  }, [userId, surface, isFetched]);

  return useMemo(() => {
    const cutoff = seenAt ? new Date(seenAt).getTime() : null;
    return {
      /** True for anything that appeared since the last visit. Never on a first visit. */
      isNew: (iso: string | null | undefined) =>
        !!cutoff && !!iso && new Date(iso).getTime() > cutoff,
    };
  }, [seenAt]);
}
