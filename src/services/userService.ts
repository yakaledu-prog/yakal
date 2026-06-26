import { MOCK_USERS, delay } from "../mock/mockData";

export interface User {
  id: string;
  name: string;
  role: string;
  email: string;
  avatar: string;
}

export const userService = {
  async getCurrentUser(role: keyof typeof MOCK_USERS = "admin"): Promise<User> {
    await delay(500);
    return MOCK_USERS[role];
  },
};
