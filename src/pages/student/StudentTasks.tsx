import { useState } from "react";
import { DataTable } from "@/components/feature/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageWrapper } from "@/components/ui/PageWrapper";

interface Task {
  id: string;
  title: string;
  subject: string;
  due: string;
  status: 'Pending' | 'In Progress' | 'Completed';
}

const mockTasks: Task[] = [
  { id: "T-01", title: "Derivatives Practice Set 1", subject: "Calculus", due: "Oct 16, 2023", status: "Pending" },
  { id: "T-02", title: "Kinematics Lab Report", subject: "Physics", due: "Oct 17, 2023", status: "In Progress" },
  { id: "T-03", title: "Read Chapter 4", subject: "Calculus", due: "Oct 15, 2023", status: "Completed" },
  { id: "T-04", title: "Algebra Midterm Review", subject: "Algebra", due: "Oct 20, 2023", status: "Pending" },
];

export function StudentTasks() {
  const [data] = useState(mockTasks);

  const columns = [
    { header: "Task ID", accessorKey: "id" },
    { header: "Title", accessorKey: "title", cell: (t: Task) => <span className="font-medium">{t.title}</span> },
    { header: "Subject", accessorKey: "subject" },
    { header: "Due Date", accessorKey: "due" },
    { header: "Status", accessorKey: "status", cell: (t: Task) => (
      <Badge variant={t.status === 'Completed' ? 'success' : t.status === 'In Progress' ? 'secondary' : 'outline'}>
        {t.status}
      </Badge>
    )},
    { header: "Action", accessorKey: "id", cell: () => (
      <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-primary/10">View</Button>
    )}
  ];

  return (
    <PageWrapper>
      <div className="space-y-6 pt-2">
        <DataTable 
          data={data} 
          columns={columns} 
          searchPlaceholder="Search tasks..." 
        />
      </div>
    </PageWrapper>
  );
}
