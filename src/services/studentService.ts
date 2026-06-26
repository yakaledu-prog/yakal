import { delay } from "../mock/mockData";

export const studentService = {
  async getDashboardSummary() {
    await delay(600);
    return {
      nextSession: {
        id: "s1",
        subject: "AP Calculus AB",
        tutor: "Dr. Alex",
        date: "Today, 4:00 PM",
        link: "https://zoom.us/j/mock",
        image: "/course_math_1782503062614.png" // We will use the generated image path later, using a placeholder for now
      },
      homeworkDue: [
        { id: "h1", title: "Derivatives Practice", subject: "Calculus", due: "Tomorrow" },
        { id: "h2", title: "Kinematics Lab Report", subject: "Physics", due: "Friday" }
      ],
      progress: {
        completedSessions: 12,
        currentStreak: 4,
        overallGrade: "A-"
      },
      announcements: [
        { id: "a1", title: "Upcoming SAT Prep Seminar", date: "Oct 15" }
      ]
    };
  }
};
