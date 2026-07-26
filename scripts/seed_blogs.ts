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

function buildHtml(sections: { heading: string | null; body: string }[]): string {
  return sections
    .map((s) => {
      let html = "";
      if (s.heading) {
        html += `<h2>${s.heading}</h2>`;
      }
      html += `<p>${s.body}</p>`;
      return html;
    })
    .join("");
}

const blogsToSeed = [
  {
    title: "5 Tips to Improve Math Grades",
    thumbnail_url: "https://images.unsplash.com/photo-1518133835878-5a93ac3f0c0f?w=800&q=80",
    read_time_minutes: 3,
    status: "published",
    content: buildHtml([
      { heading: null, body: "Many students struggle with math not because they lack ability, but because they lack a consistent strategy. By building simple, manageable habits, any student can make noticeable improvements in understanding, confidence, and grades." },
      { heading: "1. Practice in Small Daily Sessions", body: "Short, consistent practice is far more effective than occasional long study sessions. 10-20 minutes per day is enough. Build a routine after school or dinner. Mix mental math, problem sets, and revision.\\n\\nExample: Have your child solve three warm-up problems each morning to build confidence." },
      { heading: "2. Strengthen Understanding of Fundamentals", body: "Most math difficulties come from weak foundations in basic concepts. Focus on fractions and decimals, basic operations, and word-problem interpretation. When the basics are strong, advanced topics feel much easier." },
      { heading: "3. Encourage “Thinking Aloud”", body: "Students learn better when they explain their reasoning. Ask them to walk through their steps, identify gaps in logic together, and build problem-solving confidence. This habit also improves performance on exams where showing work earns partial credit." },
      { heading: "4. Use Real-Life Math Scenarios", body: "Make math practical and interesting. Examples: calculating grocery totals, comparing discounts while shopping, measuring ingredients while cooking. Real-world practice helps students understand why math matters." },
      { heading: "5. Work with a Tutor", body: "A qualified tutor can identify the exact gaps in your child's knowledge and address them directly. Personalized sessions accelerate progress far faster than classroom instruction alone." },
    ])
  },
  {
    title: "How to Prepare for Standardized Tests",
    thumbnail_url: "https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=800&q=80",
    read_time_minutes: 3,
    status: "published",
    content: buildHtml([
      { heading: null, body: "Standardized tests like the SAT and ACT can feel overwhelming, but with the right approach, students can walk in confident and perform at their best." },
      { heading: "1. Start Early", body: "Give yourself at least 3-6 months of preparation time. This allows for thorough content review, multiple practice tests, and time to address weak areas without cramming." },
      { heading: "2. Take Full Practice Tests", body: "Simulate real test conditions - timed, uninterrupted, using official materials. Review every wrong answer in detail to understand the mistake, not just the correct answer." },
      { heading: "3. Focus on Weak Areas", body: "After each practice test, categorize your errors by topic. Spend the majority of your study time on the categories with the most mistakes." },
      { heading: "4. Learn Test Strategy", body: "Beyond content knowledge, understand how the test works. Learn to eliminate answer choices, manage your time per question, and identify trap answers." },
      { heading: "5. Take Care of Yourself", body: "Sleep, nutrition, and stress management directly affect test performance. Prioritize sleep the week before the exam and arrive well-rested on test day." },
    ])
  },
  {
    title: "Building Effective Study Habits",
    thumbnail_url: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&q=80",
    read_time_minutes: 3,
    status: "published",
    content: buildHtml([
      { heading: null, body: "Good study habits are the foundation of academic success. Students who develop these habits early tend to perform better across all subjects and experience less stress." },
      { heading: "1. Create a Dedicated Study Space", body: "A quiet, organized, distraction-free environment signals to your brain that it's time to focus. Keep all study materials within reach and minimize phone distractions." },
      { heading: "2. Use Active Recall", body: "Instead of re-reading notes, test yourself on the material. Flashcards, practice questions, and self-quizzing are far more effective than passive review." },
      { heading: "3. Space Out Your Learning", body: "Spaced repetition - reviewing material at increasing intervals - dramatically improves long-term retention." },
      { heading: "4. Break Tasks Into Chunks", body: "Large assignments feel overwhelming. Break them into smaller steps and tackle one chunk at a time. This builds momentum and prevents procrastination." },
    ])
  },
  {
    title: "Maximizing Online Tutoring Sessions",
    thumbnail_url: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=800&q=80",
    read_time_minutes: 3,
    status: "published",
    content: buildHtml([
      { heading: null, body: "Online tutoring offers incredible flexibility, but students who come prepared get dramatically better results from each session." },
      { heading: "1. Prepare Questions in Advance", body: "Before each session, write down the specific concepts or problems you're struggling with. This keeps the session focused." },
      { heading: "2. Have Materials Ready", body: "Keep your textbook, class notes, and any recent assignments nearby. Your tutor may want to review specific problems from your coursework." },
      { heading: "3. Eliminate Distractions", body: "Find a quiet space, close unnecessary browser tabs, and silence your phone. A focused 45-minute session is worth more than two distracted hours." },
      { heading: "4. Review After Each Session", body: "Within 24 hours, spend 15 minutes reviewing the concepts covered. This dramatically improves retention and shows you what still needs reinforcement." },
    ])
  }
];

async function seedBlogs() {
  console.log("Seeding blogs...");
  const { data, error } = await supabase.from("blog_posts").insert(blogsToSeed);
  if (error) {
    console.error("Error seeding blogs:", error);
  } else {
    console.log("Successfully seeded blogs!");
  }
}

seedBlogs();
