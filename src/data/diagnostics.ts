export type DiagnosticQuestion = {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number; // index of the correct option
  explanation?: string;
};

export type DiagnosticTest = {
  id: string;
  title: string;
  description: string;
  categoryId: string; // "math", "ela", "physics", "standardized", "ap", "college"
  categoryName: string;
  questions: DiagnosticQuestion[];
  timeLimitMinutes?: number;
};

export const diagnosticTests: DiagnosticTest[] = [
  // --- MATH ---
  {
    id: "elem-math",
    title: "Elementary Math",
    description: "Basic operations, fractions, and introductory word problems.",
    categoryId: "math",
    categoryName: "K-12 Math",
    timeLimitMinutes: 15,
    questions: [
      { id: "q1", text: "What is 15% of 200?", options: ["15", "20", "30", "45"], correctAnswer: 2, explanation: "0.15 * 200 = 30" },
      { id: "q2", text: "Solve: 3/4 + 1/8", options: ["4/12", "7/8", "4/8", "5/8"], correctAnswer: 1, explanation: "6/8 + 1/8 = 7/8" },
    ]
  },
  {
    id: "algebra",
    title: "Algebra",
    description: "Linear equations, quadratics, and graphing.",
    categoryId: "math",
    categoryName: "K-12 Math",
    timeLimitMinutes: 20,
    questions: [
      { id: "q1", text: "Solve for x: 3x - 7 = 14", options: ["7", "3", "5", "10"], correctAnswer: 0, explanation: "3x = 21, so x = 7" },
      { id: "q2", text: "Factor: x^2 - 9", options: ["(x-3)(x-3)", "(x+3)(x-3)", "(x-9)(x+1)", "(x^2-3)"], correctAnswer: 1, explanation: "Difference of squares." },
    ]
  },
  {
    id: "geometry",
    title: "Geometry",
    description: "Angles, area, volume, and proofs.",
    categoryId: "math",
    categoryName: "K-12 Math",
    timeLimitMinutes: 20,
    questions: [
      { id: "q1", text: "What is the sum of interior angles of a hexagon?", options: ["360", "540", "720", "900"], correctAnswer: 2, explanation: "(6-2)*180 = 720" },
      { id: "q2", text: "Area of a circle with radius 3?", options: ["3π", "6π", "9π", "12π"], correctAnswer: 2, explanation: "A = πr^2 = 9π" },
    ]
  },
  {
    id: "pre-calculus",
    title: "Pre-Calculus",
    description: "Trigonometry, complex numbers, and advanced functions.",
    categoryId: "math",
    categoryName: "K-12 Math",
    timeLimitMinutes: 20,
    questions: [
      { id: "q1", text: "What is sin(π/6)?", options: ["0", "1/2", "√2/2", "√3/2"], correctAnswer: 1 },
      { id: "q2", text: "Log base 2 of 16?", options: ["2", "4", "8", "16"], correctAnswer: 1 },
    ]
  },
  {
    id: "calculus",
    title: "Calculus",
    description: "Limits, derivatives, and integrals.",
    categoryId: "math",
    categoryName: "K-12 Math",
    timeLimitMinutes: 25,
    questions: [
      { id: "q1", text: "Derivative of x^3?", options: ["3x", "3x^2", "x^2", "1/4 x^4"], correctAnswer: 1 },
      { id: "q2", text: "Integral of 2x dx?", options: ["x^2 + C", "2x^2 + C", "x + C", "2 + C"], correctAnswer: 0 },
    ]
  },

  // --- ELA ---
  {
    id: "ela-reading",
    title: "Reading Comprehension",
    description: "Passage analysis, main ideas, and tone.",
    categoryId: "ela",
    categoryName: "K-12 ELA",
    timeLimitMinutes: 20,
    questions: [
      { id: "q1", text: "Which word is a synonym for 'ubiquitous'?", options: ["Rare", "Hidden", "Everywhere", "Loud"], correctAnswer: 2 },
      { id: "q2", text: "Identify the tone: 'The sun beamed cheerfully over the meadow.'", options: ["Melancholic", "Optimistic", "Sarcastic", "Objective"], correctAnswer: 1 },
    ]
  },
  {
    id: "ela-writing",
    title: "Writing & Grammar",
    description: "Syntax, essay structure, and mechanics.",
    categoryId: "ela",
    categoryName: "K-12 ELA",
    timeLimitMinutes: 15,
    questions: [
      { id: "q1", text: "Identify the error: 'He don't like apples.'", options: ["He", "don't", "like", "apples"], correctAnswer: 1, explanation: "Should be 'doesn't'" },
      { id: "q2", text: "Which is a dependent clause?", options: ["The dog ran.", "Because it was raining.", "She smiled.", "I went home."], correctAnswer: 1 },
    ]
  },

  // --- PHYSICS ---
  {
    id: "physics-kinematics",
    title: "Kinematics & Dynamics",
    description: "Motion, forces, and Newton's laws.",
    categoryId: "physics",
    categoryName: "Physics",
    timeLimitMinutes: 20,
    questions: [
      { id: "q1", text: "What is Newton's Second Law?", options: ["F = mv", "F = ma", "E = mc^2", "p = mv"], correctAnswer: 1 },
      { id: "q2", text: "A car accelerates at 2m/s^2 for 5s from rest. Speed?", options: ["5 m/s", "10 m/s", "20 m/s", "2.5 m/s"], correctAnswer: 1 },
    ]
  },

  // --- STANDARDIZED ---
  {
    id: "sat-prep",
    title: "SAT Prep",
    description: "Digital SAT format questions for Reading/Writing and Math.",
    categoryId: "standardized",
    categoryName: "Standardized Tests",
    timeLimitMinutes: 30,
    questions: [
      { id: "q1", text: "(Math) If 2x - 4 = 10, what is 4x?", options: ["14", "28", "24", "7"], correctAnswer: 1 },
      { id: "q2", text: "(RW) Choose the best transition: '..., therefore, ...'", options: ["However", "Consequently", "Although", "Previously"], correctAnswer: 1 },
    ]
  },
  {
    id: "act-prep",
    title: "ACT Prep",
    description: "Fast-paced ACT style questions including Science.",
    categoryId: "standardized",
    categoryName: "Standardized Tests",
    timeLimitMinutes: 30,
    questions: [
      { id: "q1", text: "(Science) Independent vs Dependent variable?", options: ["Cause vs Effect", "Effect vs Cause", "Both are effects", "Constant"], correctAnswer: 0 },
      { id: "q2", text: "(Math) What is the slope of 3y = 6x + 9?", options: ["3", "6", "2", "9"], correctAnswer: 2 },
    ]
  },

  // --- AP ---
  {
    id: "ap-calc-ab",
    title: "AP Calculus AB",
    description: "Limits, derivatives, integrals, and their applications.",
    categoryId: "ap",
    categoryName: "AP Courses",
    timeLimitMinutes: 25,
    questions: [
      { id: "q1", text: "Evaluate lim(x->0) sin(x)/x", options: ["0", "1", "undefined", "infinity"], correctAnswer: 1 },
      { id: "q2", text: "If f'(x) = 0 and f''(x) < 0, the critical point is a:", options: ["Local minimum", "Local maximum", "Inflection point", "None of these"], correctAnswer: 1 },
    ]
  },
  
  // --- COLLEGE ESSAYS ---
  {
    id: "college-essays",
    title: "College Essays",
    description: "Personal statement brainstorming and narrative structure.",
    categoryId: "college",
    categoryName: "College Essays",
    timeLimitMinutes: 15,
    questions: [
      { id: "q1", text: "Which topic is generally overused in personal statements?", options: ["A unique hobby", "The 'sports injury' story", "A deeply personal cultural tradition", "A specific intellectual curiosity"], correctAnswer: 1 },
      { id: "q2", text: "The primary goal of the Common App essay is to:", options: ["List extracurriculars", "Showcase personality and values", "Explain bad grades", "Prove academic rigor"], correctAnswer: 1 },
    ]
  },
];
