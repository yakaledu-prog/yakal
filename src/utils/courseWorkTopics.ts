import type { ClassroomTopic } from "@/services/classroomService";

export function groupCourseWorkByTopic<T extends { index: number; topicId?: string | null }>(
  items: T[],
  topics: ClassroomTopic[]
): { id: string; name: string; items: T[] }[] | null {
  if (topics.length === 0) return null;

  const sections = new Map(topics.map((topic) => [topic.id, { ...topic, items: [] as T[] }]));
  const other: T[] = [];
  for (const item of items) {
    const section = item.topicId ? sections.get(item.topicId) : null;
    (section?.items ?? other).push(item);
  }

  const reindex = (rows: T[]) => rows.map((item, index) => ({ ...item, index: index + 1 }));
  const grouped = [...sections.values()]
    .filter((section) => section.items.length > 0)
    .map((section) => ({ ...section, items: reindex(section.items) }));
  if (other.length > 0) grouped.push({ id: "__ungrouped", name: "Other work", items: reindex(other) });
  return grouped;
}
