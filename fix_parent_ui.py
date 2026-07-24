import re

with open('src/pages/shared/OnboardingPage.tsx', 'r') as f:
    content = f.read()

# 1. Update theme type and state
content = content.replace(
    'const [theme, setTheme] = useState<"light" | "dark">("light");',
    'const [theme, setTheme] = useState<"light" | "dark" | "system">("light");'
)

# 2. Update theme effect
old_theme_effect = """  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);"""

new_theme_effect = """  useEffect(() => {
    if (theme === "system") {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);"""

content = content.replace(old_theme_effect, new_theme_effect)

# 3. Add newChildServices state
content = content.replace(
    'const [newChildEmail, setNewChildEmail] = useState("");',
    'const [newChildEmail, setNewChildEmail] = useState("");\n  const [newChildServices, setNewChildServices] = useState<string[]>(["tutoring"]);'
)

# 4. Update child type definition
content = content.replace(
    'const [childrenDetails, setChildrenDetails] = useState<{ email: string; services: string[] }[]>([]);',
    'const [childrenDetails, setChildrenDetails] = useState<{ email: string; services: string[]; full_name?: string; avatar_url?: string }[]>([]);'
)

# 5. Update handleAddChild
old_handle_add_child = """  const handleAddChild = () => {
    if (!newChildEmail.includes('@')) return toast.error("Please enter a valid email address");
    if (childrenDetails.some(c => c.email === newChildEmail)) return toast.error("Child already added");
    setChildrenDetails([...childrenDetails, { email: newChildEmail, services: ["tutoring"] }]);
    setNewChildEmail("");
  };"""

new_handle_add_child = """  const handleAddChild = () => {
    if (!newChildEmail.includes('@')) return toast.error("Please enter a valid email address");
    if (childrenDetails.some(c => c.email === newChildEmail)) return toast.error("Child already added");
    
    // Simulate user lookup (true if student@ or yakal is in email)
    const exists = newChildEmail.includes('student') || newChildEmail.includes('yakal') || newChildEmail.includes('amen');
    
    setChildrenDetails([...childrenDetails, { 
      email: newChildEmail, 
      services: newChildServices,
      full_name: exists ? newChildEmail.split('@')[0] : undefined,
      avatar_url: exists ? dicebearUrl(newChildEmail, "identicon") : undefined,
    }]);
    setNewChildEmail("");
    setNewChildServices(["tutoring"]);
  };"""

content = content.replace(old_handle_add_child, new_handle_add_child)

# 6. Update ParentSteps
content = content.replace(
    'const ParentSteps = ["Profile", "Children"];',
    'const ParentSteps = ["Profile", "Theme", "Children"];'
)

# 7. Update Parent Step 1 (Remove Theme, just keep Full Name)
old_parent_step_1 = """              {/* Common Step 1 fields (Only for Parent/Counselor) */}
              {step === 1 && role !== "tutor" && (
                <div className="flex flex-col gap-5">
                  <FloatingInput
                    label="Full name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="capitalize"
                  />
                  <div>
                    <p className="text-[13px] font-medium text-[#111] dark:text-white mb-2">Preferred theme</p>
                    <div className="flex gap-3">
                      {(["light", "dark"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTheme(t)}
                          className={cn(
                            "flex-1 py-3 border rounded-xl flex items-center justify-center gap-2 transition-colors",
                            theme === t
                              ? "border-[#1099A1] bg-[#1099A1]/5 text-[#1099A1]"
                              : "border-[#e9edef] dark:border-[#2a3942] text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
                          )}
                        >
                          {t === "light" ? <Sun size={18} /> : <Moon size={18} />}
                          <span className="text-[14px] font-medium capitalize">{t}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}"""

new_parent_step_1 = """              {/* Common Step 1 fields (Only for Parent/Counselor) */}
              {step === 1 && role !== "tutor" && (
                <div className="flex flex-col gap-5">
                  <FloatingInput
                    label="Full name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="capitalize"
                  />
                </div>
              )}"""
content = content.replace(old_parent_step_1, new_parent_step_1)


# 8. Add Parent Step 2 (Theme Cards) and update Parent Step 3 (Children)
old_parent_step_2_to_end = """              {/* Parent Step 2: Children (Google Drive Style) */}
              {role === "parent" && step === 2 && (
                <div className="flex flex-col gap-4">
                  <p className="text-[14px] text-[#54656f] dark:text-[#aebac1] mb-2">
                    Enter the emails of your children and select the services they will have access to.
                  </p>

                  {/* Top Input Area */}
                  <div className="flex gap-2">
                    <FloatingInput 
                      label="Child's email address"
                      value={newChildEmail}
                      onChange={(e) => setNewChildEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      type="button"
                      onClick={handleAddChild}
                      disabled={!newChildEmail.includes('@')}
                      className="bg-[#1099A1] hover:bg-[#0d848b] text-white h-[52px] px-6 rounded-xl font-medium"
                    >
                      Add
                    </Button>
                  </div>

                  {/* List of Added Children */}
                  {childrenDetails.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[13px] font-semibold text-[#111] dark:text-white mb-3 px-1">Children with access</p>
                      <div className="flex flex-col gap-2">
                        {childrenDetails.map((child, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-xl shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#1099A1]/10 text-[#1099A1] flex items-center justify-center">
                                <User size={16} />
                              </div>
                              <span className="text-[14px] font-medium text-[#111] dark:text-white truncate max-w-[150px] sm:max-w-xs">{child.email}</span>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2">
                              {/* Service toggles */}
                              <div className="flex bg-[#f8f9fa] dark:bg-[#111b21] p-1 rounded-lg border border-[#e9edef] dark:border-[#2a3942]">
                                <button
                                  type="button"
                                  onClick={() => toggleChildService(idx, 'tutoring')}
                                  className={cn("px-3 py-1.5 text-[12px] font-medium rounded-md transition-all", child.services.includes('tutoring') ? "bg-white dark:bg-[#202c33] text-[#1099A1] shadow-sm" : "text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
                                >
                                  Tutoring
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleChildService(idx, 'admissions')}
                                  className={cn("px-3 py-1.5 text-[12px] font-medium rounded-md transition-all", child.services.includes('admissions') ? "bg-white dark:bg-[#202c33] text-[#1099A1] shadow-sm" : "text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
                                >
                                  Admissions
                                </button>
                              </div>

                              <button type="button" onClick={() => handleRemoveChild(idx)} className="p-2 text-[#8696a0] hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10" title="Remove">
                                <Trash size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}"""

new_parent_step_2_to_end = """              {/* Parent Step 2: Theme Cards */}
              {role === "parent" && step === 2 && (
                <div className="flex flex-col gap-6">
                  <div>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Light Theme Card */}
                      <button
                        type="button"
                        onClick={() => setTheme("light")}
                        className={cn("flex flex-col items-center gap-3 transition-all", theme === "light" ? "opacity-100" : "opacity-60 hover:opacity-100")}
                      >
                        <div className={cn("w-full aspect-[4/3] rounded-[16px] border-2 overflow-hidden flex flex-col bg-[#f3f4f6]", theme === "light" ? "border-[#1099A1] ring-2 ring-[#1099A1]/20 shadow-md" : "border-[#e5e7eb]")}>
                          <div className="h-8 bg-white border-b border-[#e5e7eb] flex items-center px-3 justify-between">
                            <div className="w-10 h-2.5 rounded-full bg-[#111]" />
                            <div className="w-4 h-4 rounded-full bg-[#1099A1]" />
                          </div>
                          <div className="flex-1 bg-white p-3 flex flex-col gap-2">
                            <div className="w-full h-8 rounded-lg border border-[#e5e7eb]" />
                            <div className="w-full h-6 rounded-lg border border-[#e5e7eb] flex items-center justify-end px-2">
                              <Check size={12} className="text-[#9ca3af]" />
                            </div>
                          </div>
                        </div>
                        <span className="text-[14px] font-semibold text-[#111] dark:text-white">Light</span>
                      </button>

                      {/* Dark Theme Card */}
                      <button
                        type="button"
                        onClick={() => setTheme("dark")}
                        className={cn("flex flex-col items-center gap-3 transition-all", theme === "dark" ? "opacity-100" : "opacity-60 hover:opacity-100")}
                      >
                        <div className={cn("w-full aspect-[4/3] rounded-[16px] border-2 overflow-hidden flex flex-col bg-[#111827]", theme === "dark" ? "border-[#1099A1] ring-2 ring-[#1099A1]/20 shadow-md" : "border-[#1f2937]")}>
                          <div className="h-8 bg-[#1f2937] border-b border-[#374151] flex items-center px-3 justify-between">
                            <div className="w-10 h-2.5 rounded-full bg-[#d1d5db]" />
                            <div className="w-4 h-4 rounded-full bg-[#ef4444]" />
                          </div>
                          <div className="flex-1 bg-[#111827] p-3 flex flex-col gap-2">
                            <div className="w-full h-8 rounded-lg bg-[#1f2937]" />
                            <div className="w-full h-6 rounded-lg bg-[#1f2937] flex items-center justify-end px-2">
                              <Check size={12} className="text-[#4b5563]" />
                            </div>
                          </div>
                        </div>
                        <span className="text-[14px] font-semibold text-[#111] dark:text-white">Dark</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Parent Step 3: Children (Google Drive Style) */}
              {role === "parent" && step === 3 && (
                <div className="flex flex-col gap-4">
                  <p className="text-[14px] text-[#54656f] dark:text-[#aebac1] mb-2">
                    Enter the emails of your children and select the services they will have access to.
                  </p>

                  {/* Top Input Area */}
                  <div className="flex flex-col gap-3 bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[16px] p-4 shadow-sm">
                    <FloatingInput 
                      label="Child's email address"
                      value={newChildEmail}
                      onChange={(e) => setNewChildEmail(e.target.value)}
                      className="w-full"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex bg-[#f8f9fa] dark:bg-[#111b21] p-1 rounded-lg border border-[#e9edef] dark:border-[#2a3942] self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setNewChildServices(s => s.includes('tutoring') ? s.filter(x => x !== 'tutoring') : [...s, 'tutoring'])}
                          className={cn("px-3 py-1.5 text-[12px] font-medium rounded-md transition-all", newChildServices.includes('tutoring') ? "bg-white dark:bg-[#202c33] text-[#1099A1] shadow-sm" : "text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
                        >
                          Tutoring
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewChildServices(s => s.includes('admissions') ? s.filter(x => x !== 'admissions') : [...s, 'admissions'])}
                          className={cn("px-3 py-1.5 text-[12px] font-medium rounded-md transition-all", newChildServices.includes('admissions') ? "bg-white dark:bg-[#202c33] text-[#1099A1] shadow-sm" : "text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
                        >
                          Admissions
                        </button>
                      </div>
                      <Button 
                        type="button"
                        onClick={handleAddChild}
                        disabled={!newChildEmail.includes('@')}
                        className="bg-[#1099A1] hover:bg-[#0d848b] text-white px-6 rounded-lg font-medium h-10"
                      >
                        Add Student
                      </Button>
                    </div>
                  </div>

                  {/* List of Added Children */}
                  {childrenDetails.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[13px] font-semibold text-[#111] dark:text-white mb-3 px-1">Children with access</p>
                      <div className="flex flex-col gap-2">
                        {childrenDetails.map((child, idx) => {
                          const exists = !!child.full_name;
                          return (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[16px] shadow-sm">
                            <div className="flex items-center gap-3">
                              {exists ? (
                                <img src={child.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-[#e9edef] dark:border-[#2a3942]" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-[#f8f9fa] dark:bg-[#111b21] border border-dashed border-[#e9edef] dark:border-[#2a3942] text-[#8696a0] flex items-center justify-center">
                                  <User size={18} />
                                </div>
                              )}
                              <div className="flex flex-col">
                                {exists ? (
                                  <>
                                    <span className="text-[14px] font-bold text-[#111] dark:text-white leading-tight capitalize">{child.full_name}</span>
                                    <span className="text-[12px] text-[#54656f] dark:text-[#aebac1]">{child.email}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-[14px] font-bold text-[#111] dark:text-white leading-tight">{child.email}</span>
                                    <span className="text-[12px] text-[#eab308] font-medium">Pending invite</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 mt-2 sm:mt-0">
                               <div className="flex flex-col items-end gap-1">
                                  <div className="flex gap-1">
                                     {child.services.map(s => (
                                        <span key={s} className="px-2 py-0.5 bg-[#1099A1]/10 text-[#1099A1] text-[11px] font-bold rounded-full capitalize">{s}</span>
                                     ))}
                                  </div>
                               </div>
                               {!exists && (
                                  <button type="button" onClick={() => toast.success("Invite sent)} className="text-[13px] font-bold text-[#1099A1] hover:underline ml-2">Invite</button>
                               )}
                               <button type="button" onClick={() => handleRemoveChild(idx)} className="p-2 text-[#8696a0] hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10" title="Remove">
                                 <Trash size={16} />
                               </button>
                            </div>
                          </div>
                        )})}
                      </div>
                    </div>
                  )}
                </div>
              )}"""

content = content.replace(old_parent_step_2_to_end, new_parent_step_2_to_end)

with open('src/pages/shared/OnboardingPage.tsx', 'w') as f:
    f.write(content)
