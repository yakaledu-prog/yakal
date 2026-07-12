import imgAlgebra from "@/assets/images/subject-algebra.webp";
import imgPhysics from "@/assets/images/subject-physics.webp";
import imgCalculus from "@/assets/images/subject-calculus.webp";
import imgGeometry from "@/assets/images/subject-geometry.webp";
import imgSatPrep from "@/assets/images/subject-sat-prep.webp";

export type SubjectDetail = { title: string; desc: string; learn?: string[] };

export type Subject = {
  name: string;
  img: string;
  tagline?: string;
  details: SubjectDetail[];
};

export const subjects: Subject[] = [
  {
    name: "K-12 Math",
    img: imgAlgebra,
    tagline: "Building confidence one session at a time.",
    details: [
      {
        title: "Algebra",
        desc: "Equations, functions and problem-solving — the backbone that the rest of high-school math is built on.",
        learn: [
          "Understanding variables, expressions, and equations",
          "Operations with integers, fractions, and exponents",
          "Solving linear equations and inequalities",
        ]
      },
      {
        title: "Geometry",
        desc: "Shapes, angles, proofs and spatial reasoning, taught with plenty of visual, hands-on practice.",
        learn: [
          "Lines, angles, and triangles",
          "Congruence and similarity",
          "Area, volume, and coordinate geometry",
        ]
      },
      {
        title: "Pre-Calculus",
        desc: "Trigonometry, sequences and advanced functions — the bridge from algebra into calculus.",
        learn: [
          "Functions and their graphs",
          "Trigonometry and the unit circle",
          "Polynomial and rational functions",
        ]
      },
      {
        title: "Calculus",
        desc: "Limits, derivatives and integrals taught step by step, with intuition before formulas.",
        learn: [
          "Limits and continuity",
          "Derivatives and differentiation rules",
          "Integration and the fundamental theorem of calculus",
        ]
      }
    ]
  },
  {
    name: "K-12 ELA",
    img: imgGeometry, // Placeholder
    tagline: "Master reading and writing.",
    details: [
      {
        title: "K-12 ELA",
        desc: "Reading comprehension, writing, grammar and vocabulary across elementary, middle, and high school English Language Arts.",
        learn: [
          "Advanced reading comprehension strategies",
          "Essay structure and academic writing",
          "Grammar, syntax, and vocabulary expansion"
        ]
      }
    ]
  },
  {
    name: "Physics",
    img: imgPhysics,
    tagline: "Understand the laws of the universe.",
    details: [
      {
        title: "Physics",
        desc: "Mechanics, energy and electricity grounded in real-world intuition and exam technique.",
        learn: [
          "Newton's laws of motion and mechanics",
          "Energy, work, and power",
          "Waves, sound, and light",
        ]
      }
    ]
  },
  {
    name: "Standardized Tests",
    img: imgSatPrep,
    tagline: "Maximize your score with strategic preparation.",
    details: [
      {
        title: "SAT Prep",
        desc: "Targeted strategy, content review and timed practice for the digital SAT, with progress tracking.",
        learn: [
          "Math: algebra, advanced math, and data analysis",
          "Evidence-based reading and writing strategies",
          "Time management and test-taking strategies",
        ]
      },
      {
        title: "ACT Prep",
        desc: "Section-by-section coaching and pacing strategy for the ACT, English through Science.",
        learn: [
          "Math and Science section strategies",
          "English grammar and rhetoric rules",
          "Reading comprehension pacing techniques",
        ]
      }
    ]
  },
  {
    name: "AP Courses",
    img: imgCalculus, // Placeholder
    tagline: "Deepen mastery and earn college credit.",
    details: [
      {
        title: "AP Courses",
        desc: "Exam-focused support across AP subjects to deepen mastery and earn college credit.",
        learn: [
          "Subject-specific deep content review",
          "Free-response question (FRQ) strategy",
          "Multiple-choice pacing and elimination tactics"
        ]
      }
    ]
  },
  {
    name: "College Essays",
    img: imgSatPrep, // Placeholder
    tagline: "Stand out with an authentic application essay.",
    details: [
      {
        title: "College Essays",
        desc: "One-on-one coaching to brainstorm, draft and polish authentic, standout application essays.",
        learn: [
          "Brainstorming unique personal narratives",
          "Structuring the personal statement",
          "Editing for tone, clarity, and impact"
        ]
      }
    ]
  }
];
