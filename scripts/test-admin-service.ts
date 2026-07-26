import { getAdminUserDetails } from "../src/services/adminService";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function test() {
  const res = await getAdminUserDetails("cb8376ee-5d82-42da-91ed-f3d9d3753549", "student"); // Provide a valid ID if you have one, or just run it to see if it syntax fails
  console.log(JSON.stringify(res, null, 2));
}

test();
