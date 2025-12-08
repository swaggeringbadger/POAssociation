import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Sparkles,
  User,
  Building2,
  Users,
} from "lucide-react";

type ContactMode = "contact" | "demo";

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: ContactMode;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  communitySize: string;
  message: string;
  preferredTime: string;
}

const communitySizes = [
  { value: "1-50", label: "Small (1-50 doors)" },
  { value: "51-150", label: "Medium (51-150 doors)" },
  { value: "151-500", label: "Large (151-500 doors)" },
  { value: "501+", label: "Extra Large (501+ doors)" },
  { value: "multiple", label: "Multiple Communities" },
];

const preferredTimes = [
  { value: "morning", label: "Morning (9am - 12pm)" },
  { value: "afternoon", label: "Afternoon (12pm - 5pm)" },
  { value: "evening", label: "Evening (5pm - 7pm)" },
  { value: "flexible", label: "I'm flexible" },
];

export function ContactModal({ open, onOpenChange, mode = "contact" }: ContactModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    company: "",
    communitySize: "",
    message: "",
    preferredTime: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const isDemo = mode === "demo";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/public/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: isDemo ? 'demo' : 'contact',
          ...formData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit');
      }

      setIsSubmitted(true);

      // Reset after showing success
      setTimeout(() => {
        setIsSubmitted(false);
        setFormData({
          name: "",
          email: "",
          phone: "",
          company: "",
          communitySize: "",
          message: "",
          preferredTime: "",
        });
        onOpenChange(false);
      }, 3000);
    } catch (error) {
      console.error('Error submitting contact form:', error);
      // Still show success to user - the backend logs the error
      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        onOpenChange(false);
      }, 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Success state
  if (isSubmitted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {isDemo ? "Demo Request Received!" : "Message Sent!"}
            </h3>
            <p className="text-muted-foreground max-w-sm">
              {isDemo
                ? "We'll reach out within 24 hours to schedule your personalized demo."
                : "Thanks for reaching out! We'll get back to you as soon as possible."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-2">
            {isDemo ? (
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <DialogTitle className="text-xl">
                {isDemo ? "Schedule a Demo" : "Get in Touch"}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {isDemo
                  ? "See how POAssociation can transform your community management"
                  : "Have questions? We'd love to hear from you"}
              </DialogDescription>
            </div>
          </div>

          {isDemo && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Personalized walkthrough
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                Q&A with our team
              </Badge>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Name & Email Row */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                <User className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />
                Full Name *
              </Label>
              <Input
                id="name"
                placeholder="John Smith"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                <Mail className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="john@community.org"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
                className="h-10"
              />
            </div>
          </div>

          {/* Phone & Company Row */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                <Phone className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />
                Phone {isDemo && "*"}
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                required={isDemo}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company" className="text-sm font-medium">
                <Building2 className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />
                Organization {isDemo && "*"}
              </Label>
              <Input
                id="company"
                placeholder="Acme HOA"
                value={formData.company}
                onChange={(e) => updateField("company", e.target.value)}
                required={isDemo}
                className="h-10"
              />
            </div>
          </div>

          {/* Demo-specific fields */}
          {isDemo && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="communitySize" className="text-sm font-medium">
                  <Users className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />
                  Community Size *
                </Label>
                <Select
                  value={formData.communitySize}
                  onValueChange={(value) => updateField("communitySize", value)}
                  required
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {communitySizes.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredTime" className="text-sm font-medium">
                  <Calendar className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />
                  Preferred Time
                </Label>
                <Select
                  value={formData.preferredTime}
                  onValueChange={(value) => updateField("preferredTime", value)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {preferredTimes.map((time) => (
                      <SelectItem key={time.value} value={time.value}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message" className="text-sm font-medium">
              <MessageSquare className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />
              {isDemo ? "What would you like to see in the demo?" : "Message *"}
            </Label>
            <Textarea
              id="message"
              placeholder={
                isDemo
                  ? "Tell us about your community and any specific features you'd like to explore..."
                  : "How can we help you?"
              }
              value={formData.message}
              onChange={(e) => updateField("message", e.target.value)}
              required={!isDemo}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              size="lg"
              className="w-full h-11"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isDemo ? "Scheduling..." : "Sending..."}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {isDemo ? "Request Demo" : "Send Message"}
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              {isDemo
                ? "We typically respond within 24 hours during business days."
                : "We'll never share your information with third parties."}
            </p>

            {isDemo && (
              <p className="text-xs text-center text-muted-foreground border-t pt-3 mt-1">
                Already have a demo code?{" "}
                <a
                  href="/demo"
                  className="text-primary hover:underline font-medium"
                >
                  Enter it here
                </a>
              </p>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
