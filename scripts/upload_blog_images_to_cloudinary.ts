import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const CLOUD_NAME = process.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CLOUD_NAME || !UPLOAD_PRESET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const blogsImagesMap = [
  { slug: "math-grades", title: "5 Tips to Improve Math Grades", img: "blog-math-grades.webp" },
  { slug: "standardized-tests", title: "How to Prepare for Standardized Tests", img: "blog-standardized-tests.webp" },
  { slug: "study-habits", title: "Building Effective Study Habits", img: "blog-study-habits.webp" },
  { slug: "online-tutoring", title: "Maximizing Online Tutoring Sessions", img: "blog-online-tutoring.webp" },
];

async function uploadToCloudinary(filePath: string): Promise<string | null> {
  try {
    const formData = new FormData();
    const fileData = fs.readFileSync(filePath);
    const blob = new Blob([fileData], { type: "image/webp" });
    
    formData.append("file", blob);
    formData.append("upload_preset", UPLOAD_PRESET as string);
    formData.append("folder", "yakal/blogs");

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as { secure_url?: string };
    if (data.secure_url) {
      return data.secure_url;
    } else {
      console.error("Upload failed for", filePath, data);
      return null;
    }
  } catch (err) {
    console.error("Error uploading", filePath, err);
    return null;
  }
}

async function run() {
  console.log("Uploading images to Cloudinary...");
  for (const item of blogsImagesMap) {
    const imgPath = path.resolve(process.cwd(), "src/assets/images", item.img);
    if (!fs.existsSync(imgPath)) {
      console.error("File not found:", imgPath);
      continue;
    }

    const secureUrl = await uploadToCloudinary(imgPath);
    if (secureUrl) {
      console.log(`Uploaded ${item.img} to ${secureUrl}`);
      console.log(`Updating post '${item.title}' in DB...`);

      const { error } = await supabase
        .from("blog_posts")
        .update({ thumbnail_url: secureUrl })
        .eq("title", item.title);

      if (error) {
        console.error("Error updating DB for", item.title, error);
      } else {
        console.log("Successfully updated post:", item.title);
      }
    }
  }
  console.log("Done.");
}

run();
