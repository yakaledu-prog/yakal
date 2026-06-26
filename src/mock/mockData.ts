// Mock Data

export const MOCK_USERS = {
  admin: { id: "u1", name: "Theresa Webb", role: "admin", email: "theresa@yakal.test", avatar: "" },
  tutor: { id: "u2", name: "Dr. Alex", role: "tutor", email: "alex@yakal.test", avatar: "" },
  student: { id: "u3", name: "Brooklyn Simmons", role: "student", email: "brooklyn@yakal.test", avatar: "" },
  parent: { id: "u4", name: "Eleanor Simmons", role: "parent", email: "eleanor@yakal.test", avatar: "" },
};

// Simulate network delay
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
