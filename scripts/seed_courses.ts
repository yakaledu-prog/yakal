import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const coursesData = [
  {
    title: "Advanced Mathematics | University Entrance Prep",
    subject: "Mathematics",
    description: "A comprehensive course covering Calculus, Algebra, Trigonometry, and Statistics tailored for Ethiopian University Entrance Examination preparation.",
    thumbnail_url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80",
    is_active: true,
    price_cents: 6000,
    tutor_payout_cents: 4500,
    google_classroom_url: "https://classroom.google.com/c/MzUxMTE1MDYxNDEx", // example
    tutor_ids: [] // We will assign tutors if we find them
  },
  {
    title: "English Comprehension & Grammar",
    subject: "English",
    description: "Master reading comprehension, grammar rules, and vocabulary essential for the national exam.",
    thumbnail_url: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80",
    is_active: true,
    price_cents: 5000,
    tutor_payout_cents: 3500,
    google_classroom_url: "",
    tutor_ids: []
  },
  {
    title: "Physics Mechanics & Electromagnetism",
    subject: "Physics",
    description: "Deep dive into classical mechanics and electromagnetism with practical problem-solving sessions.",
    thumbnail_url: "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=800&q=80",
    is_active: true,
    price_cents: 6500,
    tutor_payout_cents: 5000,
    google_classroom_url: "",
    tutor_ids: []
  }
];

async function seed() {
  console.log("Seeding courses...");

  // Get some active tutors
  const { data: tutors, error: tutorsError } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "tutor")
    .limit(2);

  if (tutorsError) {
    console.error("Error fetching tutors:", tutorsError);
  }

  const tutorIds = tutors?.map(t => t.id) || [];

  // Assign tutors
  const records = coursesData.map(c => ({
    ...c,
    tutor_ids: tutorIds
  }));

  // Clear existing (optional, but requested so they can re-seed)
  // Delete all courses
  const { error: deleteError } = await supabase.from("courses").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all
  if (deleteError) {
    console.log("Error deleting existing courses (they might be referenced by other tables). Continuing with insert...");
  }

  // Insert
  const { error: insertError } = await supabase.from("courses").insert(records);
  if (insertError) {
    console.error("Error inserting courses:", insertError);
    process.exit(1);
  }

  console.log("Seeded courses successfully!");
}

seed();
