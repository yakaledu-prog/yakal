import re

with open("src/layouts/DashboardLayout.tsx", "r") as f:
    content = f.read()

# The layout is currently:
# return (
#   <div className="flex h-screen bg-muted/20 overflow-hidden">
#     ... mobile overlay ...
#     {/* Sidebar */}
#     <aside>...</aside>
#     {/* Main Content */}
#     <main>
#       <header>...</header>
#       <div className="flex-1 overflow-hidden ..."><Outlet/></div>
#     </main>
#     {/* Floating Search Modal */}

# We want:
# return (
#   <div className="flex flex-col h-screen bg-muted/20 overflow-hidden">
#     ... mobile overlay ...
#     <header>...</header>
#     <div className="flex flex-1 min-h-0 overflow-hidden relative">
#       <aside>...</aside>
#       <main>
#         <Outlet />
#       </main>
#     </div>
#     {/* Floating Search Modal */}

# Let's extract the components
header_match = re.search(r'(<header.*?</header>)', content, re.DOTALL)
header = header_match.group(1)

aside_match = re.search(r'(<aside.*?</aside>)', content, re.DOTALL)
aside = aside_match.group(1)

outlet_match = re.search(r'(<div className="flex-1 overflow-hidden flex flex-col dark:bg-\[\#111b21\]">\s*<Outlet.*?\/>\s*<\/div>)', content, re.DOTALL)
outlet = outlet_match.group(1)

search_modal_match = re.search(r'({\/\* Floating Search Modal \*\/\}.*?</div>)', content, re.DOTALL)
search_modal = search_modal_match.group(1) if search_modal_match else ""

# Modify Header to add Logo
header_with_logo = header.replace(
    '<div className="flex items-center gap-2 sm:gap-4">',
    '''<div className="flex items-center gap-2 sm:gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 mr-2">
              <img src={logoImg} alt="Yakal" className="h-8 object-contain" />
            </Link>'''
)
# Modify Header padding and z-index
header_with_logo = header_with_logo.replace(
    'className="h-[60px] border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#202c33] flex items-center justify-between px-6 shrink-0 transition-colors"',
    'className="h-[60px] border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#202c33] flex items-center justify-between px-4 sm:px-6 shrink-0 transition-colors z-30"'
)

# Modify Sidebar to remove Logo
aside_without_logo = aside.replace(
'''              <Link to="/" className="flex items-center gap-2">
                <img src={logoImg} alt="Yakal" className="h-10 object-contain" />
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="hidden md:flex text-muted-foreground hover:bg-accent p-1.5 rounded-md transition-colors"
              >
                <PanelLeftClose size={18} />
              </button>''',
'''              <button
                onClick={() => setSidebarOpen(false)}
                className="hidden md:flex text-muted-foreground hover:bg-accent p-1.5 rounded-md transition-colors"
              >
                <PanelLeftClose size={18} />
              </button>'''
)
aside_without_logo = aside_without_logo.replace(
    'className={cn("h-16 flex items-center px-4", sidebarOpen ? "justify-between" : "justify-center")}',
    'className={cn("h-14 flex items-center px-4", sidebarOpen ? "justify-end" : "justify-center")}'
)

new_return = f'''  return (
    <div className="flex flex-col h-screen bg-muted/20 overflow-hidden">
      {{/* Mobile Sidebar Overlay */}}
      {{sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={{() => setSidebarOpen(false)}}
        />
      )}}

      {{/* Topbar (Full width) */}}
      {header_with_logo}

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {{/* Sidebar */}}
        {aside_without_logo}

        {{/* Main Content */}}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {outlet}
        </main>
      </div>

      {search_modal}
    </div>
  );
}}
'''

# Find the start of the return statement
start_idx = content.find("  return (")
# Ensure we capture till the end of the file or the end of the component
end_idx = content.rfind("}") + 1

new_content = content[:start_idx] + new_return
with open("src/layouts/DashboardLayout.tsx", "w") as f:
    f.write(new_content)

print("Layout updated.")
