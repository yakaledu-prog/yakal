import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { getCollegeProfile, updateSchool } from "@/services/collegeService";
import { ChevronDown, Circle, CheckCircle2, ClipboardList, Loader2, Check, ExternalLink, FileText, File, Folder, MoreVertical, HardDrive, FolderSyncIcon, FolderSymlinkIcon, LayoutGrid, List as ListIcon, UploadCloud, Share2, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";
import { useGoogleDrivePicker, GoogleDriveFolder, GoogleDriveFile } from "@/hooks/useGoogleDrivePicker";
import { GoogleDrive } from "@/components/icons/GoogleDrive";

export function StudentApplicationTracker() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"requirements" | "documents" | "checklists" | "recommendations">("requirements");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [localReqs, setLocalReqs] = useState<Record<string, string[]>>({});
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});

  // Google Drive state
  const { pickFolder, pickFileFromFolder, uploadFileToFolder, fetchFolderFiles, isReady, isPicking, isFetching } = useGoogleDrivePicker();
  const [connectedFolder, setConnectedFolder] = useState<GoogleDriveFolder | null>(() => {
    const saved = localStorage.getItem('yakal_drive_folder');
    return saved ? JSON.parse(saved) : null;
  });
  const [folderFiles, setFolderFiles] = useState<GoogleDriveFile[]>([]);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [templateMappings, setTemplateMappings] = useState<Record<string, GoogleDriveFile & { shared?: boolean }>>(() => {
    const saved = localStorage.getItem('yakal_template_mappings');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    if (connectedFolder) {
      localStorage.setItem('yakal_drive_folder', JSON.stringify(connectedFolder));
    }
  }, [connectedFolder]);

  useEffect(() => {
    localStorage.setItem('yakal_template_mappings', JSON.stringify(templateMappings));
  }, [templateMappings]);

  useEffect(() => {
    if (connectedFolder && isReady) {
      fetchFolderFiles(connectedFolder.id)
        .then(files => setFolderFiles(files))
        .catch(err => console.error("Error fetching synced files:", err));
    }
  }, [connectedFolder, isReady, fetchFolderFiles]);

  const handleConnectFolder = async () => {
    try {
      const folder = await pickFolder();
      if (folder) {
        setConnectedFolder(folder);
      }
    } catch (err) {
      console.error('Failed to pick folder:', err);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["college-profile", user?.id],
    queryFn: () => getCollegeProfile(user!.id),
    enabled: !!user?.id,
  });

  if (!user) return null;

  const schools = data?.schools || [];
  const submittedCount = schools.filter(s => s.status === "submitted").length;
  const acceptedCount = schools.filter(s => s.status === "accepted").length;

  const essays = data?.essays || [];
  const tasks = data?.tasks || [];

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        {/* Header */}
        <div className="bg-[#1099A1] text-white p-6 md:p-10 !pb-0 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>
          <div className="relative z-10 max-w-[1100px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">Application Tracker</h1>
              <p className="text-white/80 text-[15px] mt-1 mb-6">Every school, every requirement</p>
            </div>

            {/* Stats in Header Bottom Right */}
            <div className="flex gap-6 pb-6 text-[13px] font-semibold text-white/80 text-center">
              <div>
                <p className="text-[22px] text-white font-bold leading-none mb-1">{schools.length}</p>
                <p>Schools</p>
              </div>
              <div>
                <p className="text-[22px] text-white font-bold leading-none mb-1">{submittedCount}</p>
                <p>Submitted</p>
              </div>
              <div>
                <p className="text-[22px] text-white font-bold leading-none mb-1">{acceptedCount}</p>
                <p>Accepted</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="max-w-[1100px] mx-auto flex gap-1 overflow-x-auto">
            {[
              { id: "requirements", label: "Requirements" },
              { id: "documents", label: "Documents" },
              { id: "checklists", label: "Checklists" },
              { id: "recommendations", label: "Recommendations" }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-[13px] font-bold uppercase tracking-wider whitespace-nowrap border-b-[3px] transition-colors",
                  tab === t.id
                    ? "border-white text-white"
                    : "border-transparent text-white/60 hover:text-white"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto p-6 md:p-10 md:pt-2 space-y-10">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : (
            <>
              {tab === "requirements" && (
                <div>
                  <div className="flex flex-col gap-6 mt-4">
                    {schools.map(s => {
                      const reqs = s.requirements || [];
                      const standardReqs = ["Application", "Essays", "Recs requested", "Recs received", "Transcript", "Test scores", "FAFSA", "CSS Profile"];

                      const toggleReq = (schoolId: string, schoolName: string, req: string) => {
                        setLocalReqs(prev => {
                          let current = prev[schoolId];
                          if (!current) {
                            current = standardReqs.filter(r => {
                              if (schoolName.includes("Hopkins")) return ["Application", "Essays", "Recs requested", "Recs received", "Transcript", "Test scores"].includes(r);
                              if (schoolName.includes("Maryland")) return false;
                              if (schoolName.includes("Michigan")) return ["Application", "Essays", "Test scores", "FAFSA", "CSS Profile"].includes(r);
                              return false;
                            });
                          }
                          if (current.includes(req)) {
                            return { ...prev, [schoolId]: current.filter(r => r !== req) };
                          }
                          return { ...prev, [schoolId]: [...current, req] };
                        });
                      };

                      const schoolReqs = localReqs[s.id] || standardReqs.filter(r => {
                        if (s.school_name.includes("Hopkins")) return ["Application", "Essays", "Recs requested", "Recs received", "Transcript", "Test scores"].includes(r);
                        if (s.school_name.includes("Maryland")) return false;
                        if (s.school_name.includes("Michigan")) return ["Application", "Essays", "Test scores", "FAFSA", "CSS Profile"].includes(r);
                        return false;
                      });

                      const mockDoneCount = schoolReqs.length;
                      const currentStatus = localStatus[s.id] || s.status;

                      return (
                        <div key={s.id} className="border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229] rounded-lg p-6">
                          {/* Top Row */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <h3 className="font-bold text-[18px] text-[#111] dark:text-white leading-tight">{s.school_name}</h3>
                              <span className="text-[14px] text-[#8696a0] font-medium">EA • {s.deadline ? s.deadline : "2026-11-01"}</span>
                            </div>

                            <div className="flex items-center gap-3 self-end md:self-auto">
                              <span className="text-[14px] font-bold text-[#54656f]">{mockDoneCount}/{Math.max(reqs.length, 8)}</span>

                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpenDropdownId(openDropdownId === s.id ? null : s.id);
                                  }}
                                  className={cn(
                                    "bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-full px-3 py-1.5 text-[13px] font-semibold flex items-center gap-1.5 hover:bg-[#f8f9fa] dark:hover:bg-[#2a3942] transition-colors",
                                    currentStatus === "accepted" ? "text-[#4FA86A]" :
                                      currentStatus === "waitlisted" ? "text-[#CAA25F]" :
                                        currentStatus === "denied" ? "text-[#CA5F5F]" :
                                          // currentStatus === "denied" ? "text-[#697780]" :
                                          currentStatus === "enrolled" ? "text-[#1099A1]" : "text-[#54656f]"
                                  )}
                                >
                                  {currentStatus === "accepted" ? "Accepted" :
                                    currentStatus === "waitlisted" ? "Waitlisted" :
                                      currentStatus === "denied" ? "Denied" :
                                        currentStatus === "enrolled" ? "Enrolled" :
                                          currentStatus === "considering" ? "Considering" :
                                            currentStatus === "applying" ? "Applying" :
                                              currentStatus === "submitted" ? "Submitted" :
                                                "Status..."}
                                  <ChevronDown size={14} className={cn("transition-transform opacity-50 ml-1", openDropdownId === s.id && "rotate-180")} />
                                </button>

                                {openDropdownId === s.id && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDropdownId(null);
                                    }} />
                                    <div className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-[#202c33] rounded-[12px] shadow-xl overflow-hidden z-50 text-black dark:text-white py-1 border border-[#e9edef] dark:border-[#2a3942]">
                                      <div className="px-4 py-2 text-[11px] font-bold text-muted-foreground/55 uppercase tracking-wider ">Set Status</div>
                                      {["considering", "applying", "submitted", "waitlisted", "accepted", "denied", "enrolled"].map((status) => (
                                        <button
                                          key={status}
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            setLocalStatus(prev => ({ ...prev, [s.id]: status }));
                                            setOpenDropdownId(null);
                                            try {
                                              await updateSchool(s.id, { status: status as any });
                                              qc.invalidateQueries({ queryKey: ["college-profile", user.id] });
                                            } catch (err) { }
                                          }}
                                          className={cn(
                                            "block w-full text-left px-4 py-2.5 text-[13px] font-bold capitalize transition-colors hover:bg-[#f8f9fa] dark:hover:bg-[#2a3942]",
                                            status === "accepted" ? "text-[#4FA86A]" :
                                              status === "waitlisted" ? "text-[#CAA25F]" :
                                                status === "denied" ? "text-[#CA5F5F]" :
                                                  status === "enrolled" ? "text-[#1099A1]" : "text-muted-foreground"
                                          )}
                                        >
                                          {status}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Progress bar */}

                          <div className={`${mockDoneCount > 0 ? 'scale-y-100' : 'scale-y-0'} transition ease-in-out duration-300 origin-left`}>
                            <div className={`h-2.5 w-full bg-[#f8f9fa] dark:bg-[#202c33] rounded-full overflow-hidden border border-[#e9edef] dark:border-[#2a3942]`}>
                              <div className="h-full bg-[#1099A1] rounded-full transition-all duration-500 ease-out" style={{ width: `${(mockDoneCount / Math.max(reqs.length, 8)) * 100}%` }} />
                            </div>
                            <div className={`${mockDoneCount > 0 ? 'h-5' : 'h-0'}`} />
                          </div>

                          {/* Pills */}
                          <div className="w-full flex items-center justify-start flex-wrap gap-2.5">
                            {standardReqs.map((req, i) => {
                              const isDone = schoolReqs.includes(req);

                              return isDone ? (
                                <button key={i} onClick={() => toggleReq(s.id, s.school_name, req)} className="bg-[#1099A1] text-white px-3.5 py-1.5 rounded-full text-[13px] flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity">
                                  <Check size={14} strokeWidth={3} /> {req}
                                </button>
                              ) : (
                                <button key={i} onClick={() => toggleReq(s.id, s.school_name, req)} className="bg-[#f8f9fa] dark:bg-[#202c33] text-[#8696a0] border border-[#e9edef] dark:border-[#2a3942] px-3.5 py-1.5 rounded-full text-[13px] hover:bg-[#e9edef] dark:hover:bg-[#2a3942] transition-colors">
                                  {req}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {schools.length === 0 && (
                      <p className="text-[14px] text-muted-foreground text-center py-10">Add schools in the College List to see requirements.</p>
                    )}
                  </div>
                </div>
              )}

              {tab === "documents" && (
                <div className="bg-white dark:bg-[#182229] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-6 h-full min-h-[400px]">

                  {!connectedFolder ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[350px] text-center">
                      <div className="w-24 h-24 mb-6">
                        <GoogleDrive className="w-full h-full" />
                      </div>
                      <h3 className="text-[18px] font-semibold text-foreground mb-2">Connect Google Drive</h3>
                      <p className="text-[14px] text-muted-foreground mb-6 max-w-[400px]">
                        Sync a dedicated folder from your Google Drive. All documents inside will automatically appear here for your college applications.
                      </p>
                      <button
                        onClick={handleConnectFolder}
                        disabled={!isReady || isPicking}
                        className={cn(
                          "flex items-center gap-2 px-6 py-3 bg-[#1099A1] text-white rounded-full text-[14px] font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5",
                          (!isReady || isPicking) && "opacity-50 cursor-not-allowed transform-none"
                        )}
                      >
                        <HardDrive size={18} />
                        {isPicking ? "Opening..." : !isReady ? "Loading..." : "Select Folder to Sync"}
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Drive Breadcrumb & Actions Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                        <div className="flex items-center text-[18px] text-[#5f6368] dark:text-[#9aa0a6] font-medium gap-2">
                          <a
                            href="https://drive.google.com/drive/my-drive"
                            target="_blank"
                            rel="noreferrer"
                            className="hover:bg-black/5 dark:hover:bg-white/5 px-2 py-1 rounded cursor-pointer transition-colors flex items-center gap-1.5"
                          >
                            <HardDrive size={18} /> My Drive
                          </a>
                          <span className="text-[14px]">›</span>
                          <span className="text-primary font-bold hover:bg-black/5 cursor-pointer hover:dark:bg-white/5 px-2 py-1 rounded">
                            {connectedFolder.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => fetchFolderFiles(connectedFolder.id).then(setFolderFiles)}
                            disabled={isFetching}
                            className={cn(
                              "flex items-center justify-center w-10 h-10 rounded-full text-[#5f6368] hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
                              isFetching && "animate-pulse"
                            )}
                            title="Refresh synced folder"
                          >
                            <FolderSyncIcon size={16} />
                          </button>
                          <a
                            href={`https://drive.google.com/drive/folders/${connectedFolder.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-4 py-2 border border-[#e9edef] dark:border-[#2a3942] rounded-full text-[14px] font-semibold text-[#1099A1] hover:bg-[#1099a1]/10 transition-colors"
                          >
                            <FolderSymlinkIcon size={16} /> Open in Drive
                          </a>
                        </div>
                      </div>

                      {/* Document Templates Section */}
                      <div className="grid md:grid-cols-2 gap-4 mb-10">
                        {[
                          { id: 'transcript', name: 'Official Transcript', expectedType: 'file' },
                          { id: 'essay', name: 'Personal Essay / Statement', expectedType: 'file' },
                          { id: 'recommendations', name: 'Letters of Recommendation', expectedType: 'folder' },
                          { id: 'portfolio', name: 'Extracurricular Portfolio', expectedType: 'folder' }
                        ].map(t => {
                          const file = templateMappings[t.id];
                          return (
                            <div key={t.id} className={cn("border rounded-xl p-4 transition-colors", file ? "border-[#1099A1] bg-[#1099A1]/5" : "border-[#e9edef] dark:border-[#2a3942] border-dashed")}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  {file ? <CheckCircle2 size={18} className="text-[#1099A1]" /> : <Circle size={18} className="text-muted-foreground opacity-50" />}
                                  <h4 className="font-semibold text-[15px]">{t.name}</h4>
                                </div>
                                {file && (
                                  <div className="relative group/menu">
                                    <button className="p-1 text-muted-foreground hover:text-foreground rounded">
                                      <MoreVertical size={16} />
                                    </button>
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#182229] border border-[#e9edef] dark:border-[#2a3942] rounded-lg shadow-lg opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 overflow-hidden">
                                      <a href={file.webViewLink} target="_blank" rel="noreferrer" className="w-full text-left px-3 py-2 text-[12px] font-semibold hover:bg-[#f8f9fa] dark:hover:bg-[#202c33] flex items-center gap-2">
                                        <ExternalLink size={14} /> Open in Drive
                                      </a>
                                      <button
                                        onClick={() => setTemplateMappings(prev => ({ ...prev, [t.id]: { ...file, shared: !file.shared } }))}
                                        className="w-full text-left px-3 py-2 text-[12px] font-semibold hover:bg-[#f8f9fa] dark:hover:bg-[#202c33] flex items-center gap-2"
                                      >
                                        <Share2 size={14} className={file.shared ? "text-[#1099A1]" : ""} /> {file.shared ? "Revoke Access" : "Share with Counselor"}
                                      </button>
                                      <button
                                        onClick={() => setTemplateMappings(prev => { const n = { ...prev }; delete n[t.id]; return n; })}
                                        className="w-full text-left px-3 py-2 text-[12px] font-semibold hover:bg-[#f8f9fa] dark:hover:bg-[#202c33] flex items-center gap-2 text-red-500"
                                      >
                                        Unassign File
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {file ? (
                                <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#182229] rounded-lg border border-[#e9edef] dark:border-[#2a3942]">
                                  {file.iconLink ? <img src={file.iconLink} alt="" className="w-6 h-6" /> : <FileText size={24} className="text-muted-foreground" />}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium truncate text-foreground">{file.name}</p>
                                    {file.shared && <p className="text-[11px] text-[#1099A1] font-medium mt-0.5">Shared with counselor</p>}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={async () => {
                                      try { const f = await pickFileFromFolder(connectedFolder.id); if (f) setTemplateMappings(prev => ({ ...prev, [t.id]: f })); }
                                      catch (err) { console.error(err); }
                                    }}
                                    disabled={!isReady || isPicking}
                                    className="flex-1 flex justify-center items-center gap-2 px-3 py-2 bg-[#f8f9fa] dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-lg text-[13px] font-medium hover:bg-black/5 transition-colors disabled:opacity-50"
                                  >
                                    <Folder size={14} /> Select from Folder
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try { const f = await uploadFileToFolder(connectedFolder.id); if (f) setTemplateMappings(prev => ({ ...prev, [t.id]: f })); }
                                      catch (err) { console.error(err); }
                                    }}
                                    disabled={!isReady || isPicking}
                                    className="flex justify-center items-center gap-2 px-3 py-2 bg-[#f8f9fa] dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-lg text-[13px] font-medium hover:bg-black/5 transition-colors disabled:opacity-50"
                                    title="Upload new file to synced folder"
                                  >
                                    <UploadCloud size={14} /> Upload
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Other Synced Files Section */}
                      <div className="flex items-center justify-between mb-4 border-b border-[#e9edef] dark:border-[#2a3942] pb-2">
                        {/* <h3 className="text-[16px] font-bold text-foreground">Other Synced Files</h3> */}
                        <div className="flex items-center bg-[#f8f9fa] dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-md overflow-hidden">
                          <button onClick={() => setViewMode('grid')} className={cn("p-1.5 transition-colors", viewMode === 'grid' ? "bg-[#e9edef] dark:bg-[#2a3942] text-foreground" : "text-muted-foreground hover:bg-black/5")}>
                            <LayoutGrid size={16} />
                          </button>
                          <button onClick={() => setViewMode('list')} className={cn("p-1.5 transition-colors", viewMode === 'list' ? "bg-[#e9edef] dark:bg-[#2a3942] text-foreground" : "text-muted-foreground hover:bg-black/5")}>
                            <ListIcon size={16} />
                          </button>
                        </div>
                      </div>

                      {isFetching && folderFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                          <Loader2 className="animate-spin mb-4" size={24} />
                          <p className="text-[13px] font-medium">Syncing...</p>
                        </div>
                      ) : folderFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                          <p className="text-[13px] font-medium">This folder is empty</p>
                        </div>
                      ) : (
                        viewMode === 'grid' ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {folderFiles.map(doc => {
                              const isMapped = Object.values(templateMappings).some(m => m.id === doc.id);
                              return (
                                <a
                                  key={doc.id}
                                  href={doc.webViewLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={cn("group flex flex-col h-40 bg-[#f8f9fa] dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden hover:border-[#1099A1] transition-colors cursor-pointer", isMapped && "opacity-60")}
                                >
                                  <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#182229] group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors">
                                    {doc.iconLink ? (
                                      <img src={doc.iconLink.replace('16', '64')} alt="icon" className="w-12 h-12 opacity-90 group-hover:scale-110 transition-transform" />
                                    ) : (
                                      <div className="text-muted-foreground group-hover:scale-110 transition-transform">
                                        <File size={48} strokeWidth={1} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="h-10 border-t border-[#e9edef] dark:border-[#2a3942] px-3 flex items-center bg-[#f8f9fa] dark:bg-[#202c33]">
                                    <div className="flex items-center gap-2 w-full">
                                      {doc.iconLink ? <img src={doc.iconLink} alt="" className="w-4 h-4 flex-shrink-0" /> : <File size={14} className="text-muted-foreground flex-shrink-0" />}
                                      <span className="text-[12px] font-semibold text-[#3c4043] dark:text-[#e8eaed] truncate" title={doc.name}>{doc.name}</span>
                                    </div>
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden">
                            {folderFiles.map(doc => {
                              const isMapped = Object.values(templateMappings).some(m => m.id === doc.id);
                              return (
                                <a
                                  key={doc.id}
                                  href={doc.webViewLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={cn("flex items-center gap-3 p-3 bg-white dark:bg-[#182229] hover:bg-[#f8f9fa] dark:hover:bg-[#202c33] border-b border-[#e9edef] dark:border-[#2a3942] last:border-b-0 transition-colors", isMapped && "opacity-60")}
                                >
                                  {doc.iconLink ? <img src={doc.iconLink} alt="" className="w-5 h-5 flex-shrink-0" /> : <File size={16} className="text-muted-foreground flex-shrink-0" />}
                                  <span className="text-[13px] font-medium text-foreground flex-1 truncate">{doc.name}</span>
                                  {isMapped && <span className="text-[11px] font-bold text-[#1099A1] px-2 py-0.5 bg-[#1099A1]/10 rounded-full">Assigned</span>}
                                  <ExternalLink size={14} className="text-muted-foreground opacity-50" />
                                </a>
                              );
                            })}
                          </div>
                        )
                      )}
                    </>
                  )}
                </div>
              )}

              {tab === "checklists" && (
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Essays Checklist */}
                  <div>
                    <h2 className="text-[15px] font-bold uppercase tracking-wider mb-4 text-foreground border-b border-[#e9edef] dark:border-[#2a3942] pb-2">
                      Essays · {essays.filter(e => e.status === "done").length}/{essays.length || 3}
                    </h2>
                    <div className="space-y-3">
                      {/* Mock MVP data as requested */}
                      <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 size={16} className="text-[#1099A1]" />
                          <span className="text-[14px] font-semibold">Activities descriptions</span>
                        </div>
                        <span className="text-[12px] font-bold text-muted-foreground">Complete</span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 size={16} className="text-[#1099A1]" />
                          <span className="text-[14px] font-semibold">Common App personal statement</span>
                        </div>
                        <span className="text-[12px] font-bold text-muted-foreground">Complete</span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                        <div className="flex items-center gap-3">
                          <Circle size={16} className="text-muted-foreground/40" />
                          <span className="text-[14px] font-semibold">JHU "why us" supplement</span>
                        </div>
                        <span className="text-[12px] font-bold text-[#CAA25F]">In progress</span>
                      </div>
                    </div>
                  </div>

                  {/* To-Do */}
                  <div>
                    <h2 className="text-[15px] font-bold uppercase tracking-wider mb-4 text-foreground border-b border-[#e9edef] dark:border-[#2a3942] pb-2">
                      To-do · {tasks.filter(t => t.status === "done").length}/{tasks.length || 3}
                    </h2>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                        <div className="flex items-center gap-3">
                          <Circle size={16} className="text-muted-foreground/40" />
                          <span className="text-[14px] font-semibold">Request recommendation letters</span>
                        </div>
                        <span className="text-[12px] font-bold text-[#CAA25F]">In progress</span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                        <div className="flex items-center gap-3">
                          <Circle size={16} className="text-muted-foreground/40" />
                          <span className="text-[14px] font-semibold">Finalize school list</span>
                        </div>
                        <span className="text-[12px] font-bold text-[#CAA25F]">In progress</span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                        <div className="flex items-center gap-3">
                          <Circle size={16} className="text-muted-foreground/40" />
                          <span className="text-[14px] font-semibold">Submit FAFSA</span>
                        </div>
                        <span className="text-[12px] font-bold text-[#CAA25F]">In progress</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === "recommendations" && (
                <div>
                  <div className="flex items-center justify-between mb-2 border-b border-[#e9edef] dark:border-[#2a3942] pb-2">
                    <h2 className="text-[15px] font-bold uppercase tracking-wider text-foreground">Recommendation letters</h2>
                    <button className="text-[13px] font-bold text-[#1099A1] flex items-center gap-1"><Plus size={14} /> Add</button>
                  </div>
                  <p className="text-[14px] text-muted-foreground mb-4">Recommenders and where each letter lives in Google Drive</p>

                  <div className="border border-[#e9edef] dark:border-[#2a3942] border-dashed p-6 text-center bg-[#f8fafc] dark:bg-[#1a2730]">
                    <p className="text-[14px] text-muted-foreground mb-2">Add each teacher or counselor writing a letter, then drop the signed letter in the student’s Drive folder and paste its link.</p>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </PageWrapper>
  );
}
