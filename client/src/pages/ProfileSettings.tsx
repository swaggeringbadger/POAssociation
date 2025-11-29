import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Calendar, Copy, RefreshCw, ExternalLink, Check, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { getCalendarFeedToken, regenerateCalendarFeedToken, type CalendarFeedToken } from "@/lib/api";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().optional(),
  email: z.string().email("Valid email required"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface NotificationPreferences {
  applicationSubmitted: boolean;
  applicationApproved: boolean;
  applicationRejected: boolean;
  commentsAdded: boolean;
  stepAssigned: boolean;
}

const notificationTypes: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: "applicationSubmitted", label: "Application Submitted", description: "When your application is received" },
  { key: "applicationApproved", label: "Application Approved", description: "When your application is approved" },
  { key: "applicationRejected", label: "Application Rejected", description: "When your application is rejected" },
  { key: "commentsAdded", label: "Comments Added", description: "When new comments are added to your application" },
  { key: "stepAssigned", label: "Step Assigned", description: "When you're assigned a new workflow step" },
];

export default function ProfileSettings() {
  const { user } = useAuth();
  const { setCurrentPageTitle } = useAppStore();
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    applicationSubmitted: true,
    applicationApproved: true,
    applicationRejected: true,
    commentsAdded: true,
    stepAssigned: true,
  });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phoneNumber: user?.phoneNumber || "",
      email: user?.email || "",
    },
  });

  // Load notification preferences from user
  useEffect(() => {
    if (user?.notificationPreferences) {
      try {
        const prefs = typeof user.notificationPreferences === 'string' 
          ? JSON.parse(user.notificationPreferences)
          : user.notificationPreferences;
        setNotifications(prefs);
      } catch (e) {
        console.error('Failed to parse notification preferences', e);
      }
    }
  }, [user?.notificationPreferences]);

  // Set page title
  useEffect(() => {
    setCurrentPageTitle("Profile Settings");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData & { notificationPreferences: NotificationPreferences }) => {
      const res = await fetch(`/api/users/${user?.id}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Profile updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate({ ...data, notificationPreferences: notifications });
  };

  // Check if user is a demo user (has demoCodeId)
  const isDemoUser = !!user?.demoCodeId;

  const email = watch("email");
  const firstName = watch("firstName");
  const lastName = watch("lastName");
  const phoneNumber = watch("phoneNumber");

  const hasChanges = 
    firstName !== user?.firstName ||
    lastName !== user?.lastName ||
    phoneNumber !== user?.phoneNumber ||
    (isEditingEmail && email !== user?.email) ||
    JSON.stringify(notifications) !== JSON.stringify(user?.notificationPreferences ? 
      (typeof user.notificationPreferences === 'string' ? JSON.parse(user.notificationPreferences) : user.notificationPreferences) 
      : {});

  const toggleNotification = (key: keyof NotificationPreferences) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Calendar feed state
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: feedToken, isLoading: feedLoading } = useQuery({
    queryKey: ['calendarFeedToken'],
    queryFn: getCalendarFeedToken,
  });

  const regenerateMutation = useMutation({
    mutationFn: regenerateCalendarFeedToken,
    onSuccess: (data) => {
      queryClient.setQueryData(['calendarFeedToken'], data);
      toast.success('Calendar feed URL regenerated. Your old URL will no longer work.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to regenerate calendar feed');
    },
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3" data-testid="settings-tabs">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Manage your account information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* First Name */}
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    placeholder="Enter your first name"
                    {...register("firstName")}
                    data-testid="input-firstname"
                    disabled={updateProfileMutation.isPending}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName.message}</p>
                  )}
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    placeholder="Enter your last name"
                    {...register("lastName")}
                    data-testid="input-lastname"
                    disabled={updateProfileMutation.isPending}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName.message}</p>
                  )}
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    placeholder="Enter your phone number"
                    type="tel"
                    {...register("phoneNumber")}
                    data-testid="input-phone"
                    disabled={updateProfileMutation.isPending}
                  />
                  {errors.phoneNumber && (
                    <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email">Email Address</Label>
                    {isDemoUser && (
                      <button
                        type="button"
                        onClick={() => setIsEditingEmail(!isEditingEmail)}
                        className="text-xs text-primary hover:underline"
                        data-testid="button-edit-email"
                      >
                        {isEditingEmail ? "Cancel" : "Edit"}
                      </button>
                    )}
                  </div>
                  {isDemoUser && !isEditingEmail ? (
                    <div className="px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                      {user?.email}
                    </div>
                  ) : (
                    <>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        {...register("email")}
                        data-testid="input-email"
                        disabled={!isDemoUser || updateProfileMutation.isPending}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                      )}
                      {!isDemoUser && (
                        <p className="text-xs text-muted-foreground">
                          Email editing is only available for demo accounts
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending || !hasChanges}
                    data-testid="button-save-profile"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => reset()}
                    disabled={updateProfileMutation.isPending || !hasChanges}
                    data-testid="button-cancel-profile"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose which notifications you'd like to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Notification Types */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Email Notifications</h3>
                {notificationTypes.map(({ key, label, description }) => (
                  <div key={key} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id={`notif-${key}`}
                      checked={notifications[key]}
                      onCheckedChange={() => toggleNotification(key)}
                      data-testid={`checkbox-notification-${key}`}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`notif-${key}`} className="font-medium text-sm cursor-pointer">
                        {label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">{description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Save Button */}
              <Button
                onClick={() => {
                  const formData = new FormData();
                  const profileForm = document.querySelector('form') as HTMLFormElement;
                  if (profileForm) {
                    const formDataObj = new FormData(profileForm);
                    handleSubmit((data) => {
                      updateProfileMutation.mutate({ ...data, notificationPreferences: notifications });
                    })(new Event('submit') as any);
                  }
                }}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-notifications"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Preferences"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Calendar Subscription
              </CardTitle>
              <CardDescription>
                Subscribe to your events in iPhone Calendar, Google Calendar, Outlook, or any calendar app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {feedLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : feedToken ? (
                <>
                  {/* Feed URL */}
                  <div className="space-y-2">
                    <Label>Your Calendar Feed URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={feedToken.feedUrl}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(feedToken.feedUrl)}
                        title="Copy to clipboard"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This URL is unique to you. Keep it private and don't share it.
                    </p>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">How to subscribe:</h4>

                    <div className="space-y-3 text-sm">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="font-medium">iPhone / iPad Calendar</p>
                        <ol className="list-decimal list-inside mt-2 text-muted-foreground space-y-1">
                          <li>Go to <strong>Settings &gt; Calendar &gt; Accounts</strong></li>
                          <li>Tap <strong>Add Account &gt; Other</strong></li>
                          <li>Tap <strong>Add Subscribed Calendar</strong></li>
                          <li>Paste the URL above and tap <strong>Next</strong></li>
                        </ol>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="font-medium">Google Calendar</p>
                        <ol className="list-decimal list-inside mt-2 text-muted-foreground space-y-1">
                          <li>Open Google Calendar on desktop</li>
                          <li>Click <strong>+ next to "Other calendars"</strong></li>
                          <li>Select <strong>From URL</strong></li>
                          <li>Paste the URL above and click <strong>Add calendar</strong></li>
                        </ol>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="font-medium">Outlook</p>
                        <ol className="list-decimal list-inside mt-2 text-muted-foreground space-y-1">
                          <li>Open Outlook and go to Calendar</li>
                          <li>Click <strong>Add calendar &gt; Subscribe from web</strong></li>
                          <li>Paste the URL above and click <strong>Import</strong></li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  {feedToken.lastAccessedAt && (
                    <div className="p-3 rounded-lg border bg-muted/30">
                      <p className="text-xs text-muted-foreground">
                        Last synced: {new Date(feedToken.lastAccessedAt).toLocaleString()}
                        {feedToken.accessCount > 0 && (
                          <> • Synced {feedToken.accessCount} time{feedToken.accessCount !== 1 ? 's' : ''}</>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Regenerate Button */}
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span className="text-sm">
                        If your calendar URL has been compromised, you can regenerate it.
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => regenerateMutation.mutate()}
                        disabled={regenerateMutation.isPending}
                        className="ml-4 shrink-0"
                      >
                        {regenerateMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Regenerate URL
                      </Button>
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Unable to load calendar feed. Please try again later.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">User ID</p>
            <p className="text-sm font-mono text-foreground">{user?.id}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Account Type</p>
            <p className="text-sm text-foreground">
              {isDemoUser ? "Demo Account" : "Standard Account"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Member Since</p>
            <p className="text-sm text-foreground">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
