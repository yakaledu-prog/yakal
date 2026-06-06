import imgAlgebra from "@/assets/images/subject-algebra.png";
import imgPhysics from "@/assets/images/subject-physics.png";
import imgCalculus from "@/assets/images/subject-calculus.png";
import imgGeometry from "@/assets/images/subject-geometry.png";
import imgSatPrep from "@/assets/images/subject-sat-prep.png";

export type Subject = { name: string; img: string };

export type SubjectDetail = { title: string; desc: string; learn: string[] };

export const subjects: Subject[] = [
  { name: "Algebra", img: imgAlgebra },
  { name: "Physics", img: imgPhysics },
  { name: "Calculus", img: imgCalculus },
  { name: "Pre-Calculus", img: imgCalculus },
  { name: "Geometry", img: imgGeometry },
  { name: "SAT Prep", img: imgSatPrep },
];

export const subjectDetails: Record<string, SubjectDetail> = {
  Algebra: {
    title: "Algebra 1 & 2",
    desc: "Build a strong mathematical foundation with a clear, engaging introduction to algebra. This course helps students move from basic arithmetic to confident problem-solving using variables, equations, and real-world applications.",
    learn: [
      "Understanding variables, expressions, and equations",
      "Operations with integers, fractions, and exponents",
      "Solving linear equations and inequalities",
    ],
  },
  Physics: {
    title: "Physics",
    desc: "Explore the fundamental laws governing the universe. From mechanics to electromagnetism, this course makes complex physics concepts approachable and prepares students for AP Physics and beyond.",
    learn: [
      "Newton's laws of motion and mechanics",
      "Energy, work, and power",
      "Waves, sound, and light",
    ],
  },
  Calculus: {
    title: "Calculus",
    desc: "Master the mathematics of change. This course covers limits, derivatives, integrals, and their real-world applications, preparing students for AP Calculus AB/BC and college-level math.",
    learn: [
      "Limits and continuity",
      "Derivatives and differentiation rules",
      "Integration and the fundamental theorem of calculus",
    ],
  },
  "Pre-Calculus": {
    title: "Pre-Calculus",
    desc: "Bridge the gap between algebra and calculus. Build fluency in functions, trigonometry, and analytic geometry to set yourself up for success in higher-level math.",
    learn: [
      "Functions and their graphs",
      "Trigonometry and the unit circle",
      "Polynomial and rational functions",
    ],
  },
  Geometry: {
    title: "Geometry",
    desc: "Develop logical reasoning and spatial thinking. This course covers proofs, shapes, transformations, and coordinate geometry with a focus on building problem-solving skills.",
    learn: [
      "Lines, angles, and triangles",
      "Congruence and similarity",
      "Area, volume, and coordinate geometry",
    ],
  },
  "SAT Prep": {
    title: "SAT Prep",
    desc: "Maximize your SAT score with focused, strategic preparation. Our expert tutors cover every section of the SAT with proven techniques and personalized practice plans.",
    learn: [
      "Math: algebra, advanced math, and data analysis",
      "Evidence-based reading and writing strategies",
      "Time management and test-taking strategies",
    ],
  },
};
