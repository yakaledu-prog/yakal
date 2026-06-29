import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Video, FileText, Download, CheckCircle } from "lucide-react";

export function TutorSessionDetail() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Badge className="mb-2">Upcoming Session</Badge>
          <h2 className="text-3xl font-bold tracking-tight">AP Calculus AB</h2>
          <p className="text-muted-foreground mt-1">Today at 4:00 PM - 5:00 PM</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Reschedule</Button>
          <Button className="gap-2 bg-[#f26b4d] hover:bg-[#d8583d] text-white">
            <Video size={18} /> Join Meeting
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Session Agenda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>In this session, we will focus on the chain rule and its applications in related rates problems. Make sure to have your textbook ready.</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Review of previous homework (10 mins)</li>
                <li>Introduction to the Chain Rule (20 mins)</li>
                <li>Practice Problems together (20 mins)</li>
                <li>Q&A and next steps (10 mins)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Homework Assigned</CardTitle>
              <CardDescription>To be completed before next session.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-md text-primary"><FileText size={20} /></div>
                  <div>
                    <p className="font-medium text-sm">Derivatives Practice Set 1</p>
                    <p className="text-xs text-muted-foreground">Due Oct 16</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Start Task</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tutor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-accent border flex items-center justify-center overflow-hidden">
                  <img src="https://i.pravatar.cc/150?u=u2" alt="Tutor" className="h-full w-full object-cover" />
                </div>
                <div>
                  <h4 className="font-medium">Dr. Alex</h4>
                  <p className="text-xs text-muted-foreground">Mathematics Dept.</p>
                </div>
              </div>
              <Button variant="secondary" className="w-full mt-4">Send Message</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 hover:bg-muted rounded-md transition-colors cursor-pointer group">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-emerald-500" />
                  <span>Chapter 4 PDF</span>
                </div>
                <Download size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-center justify-between p-2 hover:bg-muted rounded-md transition-colors cursor-pointer group">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-emerald-500" />
                  <span>Formula Sheet</span>
                </div>
                <Download size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
