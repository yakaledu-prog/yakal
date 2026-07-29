import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Starting dashboard seed...");

  // Find counselor Daniel Haile
  const { data: counselor } = await supabase.from("profiles").select("id").eq("full_name", "Daniel Haile").single();
  if (!counselor) throw new Error("Counselor Daniel Haile not found");

  // Find student Amen Worku
  const { data: student } = await supabase.from("profiles").select("id").eq("full_name", "Amen Worku").single();
  if (!student) throw new Error("Student Amen Worku not found");

  console.log("Counselor ID:", counselor.id);
  console.log("Student ID:", student.id);

  // Link them if not linked
  const { data: existingApp } = await supabase.from("college_guide_applications").select("id").eq("student_id", student.id).single();
  if (existingApp) {
    await supabase.from("college_guide_applications").update({ counselor_id: counselor.id }).eq("id", existingApp.id);
  } else {
    await supabase.from("college_guide_applications").insert({
      student_id: student.id,
      counselor_id: counselor.id,
      status: "active",
      stage: "apply"
    });
  }

  // Find colleges from catalog
  const { data: mit } = await supabase.from("college_catalog").select("unitid, name").ilike("name", "%Massachusetts Institute of Technology%").limit(1).single();
  const { data: harvard } = await supabase.from("college_catalog").select("unitid, name").ilike("name", "%Harvard University%").limit(1).single();
  const { data: stanford } = await supabase.from("college_catalog").select("unitid, name").ilike("name", "%Stanford University%").limit(1).single();

  const addSchool = async (school: any, deadline: string, reqs: any[]) => {
    if (!school) return;
    const { data: item } = await supabase.from("college_list_items").insert({
      student_id: student.id,
      school_name: school.name,
      unitid: school.unitid,
      tier: "reach",
      status: "applying",
      deadline
    }).select().single();

    if (item) {
      await supabase.from("application_requirements").insert(
        reqs.map(r => ({ college_list_item_id: item.id, label: r.label, is_complete: r.is_complete }))
      );
    }
  };

  // Clean old deadlines for this student so we don't duplicate forever
  await supabase.from("college_list_items").delete().eq("student_id", student.id);

  const today = new Date();
  
  const in3Days = new Date(today);
  in3Days.setDate(today.getDate() + 3);
  
  const passed = new Date(today);
  passed.setDate(today.getDate() - 2);
  
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);

  await addSchool(mit, in3Days.toISOString().split('T')[0], [
    { label: "Application submitted", is_complete: true },
    { label: "Supplemental essays", is_complete: false },
    { label: "Transcript sent", is_complete: true }
  ]);

  await addSchool(harvard, passed.toISOString().split('T')[0], [
    { label: "Application submitted", is_complete: true },
    { label: "Supplemental essays", is_complete: true }
  ]);
  
  await addSchool(stanford, in30Days.toISOString().split('T')[0], [
    { label: "Application submitted", is_complete: false },
    { label: "Transcript sent", is_complete: false }
  ]);

  // Clean old sessions
  await supabase.from("sessions").delete().eq("counselor_id", counselor.id).eq("student_id", student.id);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  await supabase.from("sessions").insert([
    {
      counselor_id: counselor.id,
      student_id: student.id,
      tutor_id: counselor.id,
      subject: "College Essay Review",
      date: today.toISOString().split('T')[0],
      start_time: "15:00:00",
      duration_minutes: 60,
      status: "scheduled",
      meeting_link: "https://zoom.us/j/123456789"
    },
    {
      counselor_id: counselor.id,
      student_id: student.id,
      tutor_id: counselor.id,
      subject: "Application Strategy",
      date: tomorrow.toISOString().split('T')[0],
      start_time: "10:00:00",
      duration_minutes: 45,
      status: "scheduled",
      meeting_link: "https://zoom.us/j/987654321"
    }
  ]);

  console.log("Seeding complete!");
}

main().catch(console.error);
