const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'src/pages/shared/OnboardingPage.tsx');
let content = fs.readFileSync(p, 'utf8');

// 1. imports
content = content.replace('import { useNavigate }', 'import { useNavigate, Link }');
content = content.replace('import { Check, Upload, Loader2, UploadCloud, FileText, ChevronRight, ChevronLeft, GraduationCap, Users, BookOpen }', 'import { Check, Upload, Loader2, UploadCloud, FileText, ChevronRight, ChevronLeft, GraduationCap, Users, BookOpen, Trash }');

// 2. Avatar Identicon + Phone
content = content.replace('setAvatarUrl(initialsAvatarUrl(""))', 'setAvatarUrl(`https://api.dicebear.com/7.x/identicon/svg?seed=preview`)');
content = content.replace('setAvatarUrl(profile.avatar_url || initialsAvatarUrl(profile.full_name || ""));', 'setAvatarUrl(profile.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.id || profile.full_name || "yakal"}`);');

content = content.replace(/if \(prev && prev\.includes\("\/initials\/"\)\) \{\n\s*const bg = prev\.match\(\/backgroundColor=\(\[0-9a-fA-F\]\+\)\/\)\?\.\[1\];\n\s*return initialsAvatarUrl\(fullName, bg\);\n\s*\}/g, 'if (prev && prev.includes("api.dicebear.com/7.x/identicon")) {\n        return `https://api.dicebear.com/7.x/identicon/svg?seed=${fullName || "yakal"}`;\n      }');

content = content.replace('shadow-md', 'shadow-inner');

content = content.replace(/<FloatingInput\s*label="Phone number \(Optional\)"\s*type="tel"\s*value=\{phone\}\s*onChange=\{\(e\) => setPhone\(e\.target\.value\)\}\s*\/>/g, '');

// 3. Logo Link
content = content.replace('<img src={logoImg} alt="Yakal" className="h-10 object-contain" />', '<Link to="/"><img src={logoImg} alt="Yakal" className="h-10 object-contain" /></Link>');

// 4. Tutor Subject Split
content = content.replace('if (step === 1) return setStep(2);', 'if (step === 1) return setStep(2);\n      if (step === 2) return setStep(3);');
content = content.replace('renderStepIndicator(step, 2)', 'renderStepIndicator(step, 3)');
content = content.replace('step === 2) ? "Complete Setup" : "Continue"', 'step >= 3) ? "Complete Setup" : "Continue"');

// Split tutor step 2 into step 2 and 3 UI
const tutorStep2Old = `              {/* === TUTOR STEP 2: Qualifications === */}
              {role === "tutor" && step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="text-center mb-8">
                    <h1 className="text-[24px] font-bold text-[#111] dark:text-white leading-tight">
                      Your Qualifications
                    </h1>
                    <p className="text-[#54656f] dark:text-[#aebac1] text-[14px] mt-1.5">
                      Tell us what you can teach and provide your resume.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>`;
const tutorStep2New = `              {/* === TUTOR STEP 2: Resume === */}
              {role === "tutor" && step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-6">
                    <div>`;
content = content.replace(tutorStep2Old, tutorStep2New);

const tutorSubjectsSplitOld = `                      </div>
                    </div>

                    <div>
                      <p className="text-[13px] font-medium text-[#111] dark:text-white mb-2">
                        Subjects you teach {subjects.length > 0 && <span className="text-[#1099A1] font-semibold">({subjects.length})</span>}
                      </p>`;
const tutorSubjectsSplitNew = `                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === TUTOR STEP 3: Subjects === */}
              {role === "tutor" && step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-6">
                    <div>
                      <p className="text-[13px] font-medium text-[#111] dark:text-white mb-2">
                        Subjects you teach {subjects.length > 0 && <span className="text-[#1099A1] font-semibold">({subjects.length})</span>}
                      </p>`;
content = content.replace(tutorSubjectsSplitOld, tutorSubjectsSplitNew);


// 5. Remove texts
const parentStep1Text = `                  <div className="text-center mb-8">
                    <h1 className="text-[24px] font-bold text-[#111] dark:text-white leading-tight">
                      Complete your profile
                    </h1>
                    <p className="text-[#54656f] dark:text-[#aebac1] text-[14px] mt-1.5">
                      Let's start with the basics.
                    </p>
                  </div>`;
content = content.replace(parentStep1Text, '');

const parentStep2Text = `                  <div className="text-center mb-8">
                    <h1 className="text-[24px] font-bold text-[#111] dark:text-white leading-tight">
                      Add your children
                    </h1>
                    <p className="text-[#54656f] dark:text-[#aebac1] text-[14px] mt-1.5">
                      Invite them to Yakal and assign services.
                    </p>
                  </div>`;
content = content.replace(parentStep2Text, '');

const parentStep3Text = `                  <div className="text-center mb-8">
                    <div className="w-12 h-12 rounded-full bg-[#1099A1]/10 flex items-center justify-center mx-auto mb-4 text-[#1099A1]">
                      <BookOpen size={24} />
                    </div>
                    <h1 className="text-[24px] font-bold text-[#111] dark:text-white leading-tight">
                      Explore Courses
                    </h1>
                    <p className="text-[#54656f] dark:text-[#aebac1] text-[14px] mt-1.5">
                      Kickstart their learning by booking a course now.
                    </p>
                  </div>`;
content = content.replace(parentStep3Text, '');

const parentStep4TextOld = `                <div className="animate-in fade-in slide-in-from-right-4 duration-300 text-center">
                  <img src={subjAdvising} alt="College Admissions" className="w-full h-48 rounded-xl object-cover mb-6 border border-[#e9edef] dark:border-[#2a3942]" />
                  <h1 className="text-[24px] font-bold text-[#111] dark:text-white leading-tight mb-2">
                    College Admissions Guidance
                  </h1>
                  <p className="text-[#54656f] dark:text-[#aebac1] text-[14px] mb-6">
                    Our expert counselors will guide your child through every step of the college application process, from essay writing to interview prep. We'll set up a kickoff meeting on your dashboard.
                  </p>
                </div>`;
const parentStep4TextNew = `                <div className="animate-in fade-in slide-in-from-right-4 duration-300 text-center">
                  <img src={subjAdvising} alt="College Admissions" className="w-full h-48 rounded-xl object-cover mb-6 border border-[#e9edef] dark:border-[#2a3942]" />
                </div>`;
content = content.replace(parentStep4TextOld, parentStep4TextNew);

fs.writeFileSync(p, content);
console.log('done');
