import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ARCH_REQUEST_FORM_SCHEMA } from "@/lib/mock-data";
import { ArrowUpRight, Clock, FileCheck, Plus, Sparkles } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Pending Requests" value="12" icon={Clock} trend="+2 from yesterday" />
        <StatsCard title="Active Violations" value="3" icon={ArrowUpRight} trend="-1 from last week" />
        <StatsCard title="Approved Projects" value="89" icon={FileCheck} trend="+15% this month" />
        <StatsCard title="Total Units" value="245" icon={Plus} trend="Fully occupied" />
      </div>

      <div className="grid gap-8 md:grid-cols-7">
        {/* Main Activity Feed */}
        <div className="col-span-4 space-y-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent Applications</CardTitle>
              <CardDescription>Latest architectural modification requests requiring review.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold">
                        JD
                      </div>
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors cursor-pointer">Fence Installation - 123 Oak St</p>
                        <p className="text-sm text-muted-foreground">Submitted 2 days ago by Jane Doe</p>
                      </div>
                    </div>
                    <Badge variant={i === 1 ? "default" : "secondary"}>
                      {i === 1 ? "Needs Review" : "In Progress"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-primary/5 border-primary/20">
             <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Link href="/apply">
                <Button>Start New Application</Button>
              </Link>
              <Link href="/apply/markland-demo">
                <Button variant="secondary" className="border-primary/20 border">
                    <Sparkles className="mr-2 h-4 w-4 text-primary" />
                    Demo: Markland Form
                </Button>
              </Link>
              <Button variant="outline">Report Violation</Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar / Context */}
        <div className="col-span-3 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Community Status</CardTitle>
              <CardDescription>Whispering Pines HOA</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Next Board Meeting</span>
                <span className="font-medium">Nov 28, 7:00 PM</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Management Rep</span>
                <span className="font-medium">Sarah Jenkins</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Office Hours</span>
                <span className="font-medium">M-F, 9am - 5pm</span>
              </div>
            </CardContent>
          </Card>

          {/* Mockup of the "Revolutionary Wizard" Promo */}
          <Card className="bg-gradient-to-br from-primary to-blue-600 text-primary-foreground border-none overflow-hidden relative">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 bg-white/10 rounded-full blur-xl"></div>
            <CardHeader>
              <CardTitle className="text-white">Form Wizard Beta</CardTitle>
              <CardDescription className="text-blue-100">
                Try our new AI-powered form builder to create custom intake flows for your community.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full text-primary font-bold">
                Launch Builder
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, trend }: { title: string, value: string, icon: any, trend: string }) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{trend}</p>
      </CardContent>
    </Card>
  );
}
