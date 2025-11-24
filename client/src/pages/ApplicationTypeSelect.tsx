import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Home,
  Hammer,
  TreePine,
  Fence,
  Building2,
  Signpost
} from "lucide-react";

const APPLICATION_TYPES = [
  {
    id: "exterior-modifications",
    title: "Exterior Modifications",
    description: "Paint colors, siding, trim, windows, doors, roofing",
    icon: Home,
    examples: [
      "Paint color changes",
      "Window replacements",
      "Roofing materials",
      "Siding modifications"
    ]
  },
  {
    id: "structural-changes",
    title: "Structural Changes",
    description: "Additions, extensions, structural modifications",
    icon: Hammer,
    examples: [
      "Room additions",
      "Garage modifications",
      "Porch/deck additions",
      "Foundation changes"
    ]
  },
  {
    id: "landscaping",
    title: "Landscaping",
    description: "Trees, plants, irrigation, hardscaping",
    icon: TreePine,
    examples: [
      "Tree removal/planting",
      "Garden installations",
      "Irrigation systems",
      "Walkways/patios"
    ]
  },
  {
    id: "fencing",
    title: "Fencing & Barriers",
    description: "Fences, gates, privacy screens, retaining walls",
    icon: Fence,
    examples: [
      "Privacy fencing",
      "Decorative gates",
      "Retaining walls",
      "Pool barriers"
    ]
  },
  {
    id: "outdoor-structures",
    title: "Outdoor Structures",
    description: "Sheds, gazebos, pergolas, pools, outdoor kitchens",
    icon: Building2,
    examples: [
      "Storage sheds",
      "Gazebos/pergolas",
      "Swimming pools",
      "Outdoor kitchens"
    ]
  },
  {
    id: "signage",
    title: "Signage",
    description: "Address signs, decorative signs, business signage",
    icon: Signpost,
    examples: [
      "Address markers",
      "Decorative signs",
      "Security signs",
      "Business signage"
    ]
  }
];

export default function ApplicationTypeSelect() {
  const [, navigate] = useLocation();

  const handleTypeSelect = (typeId: string) => {
    navigate(`/applications/submit/${typeId}`);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-light text-gray-900 mb-4 sm:mb-6">
        What type of enhancement are you planning?
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {APPLICATION_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <Card
              key={type.id}
              className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
              onClick={() => handleTypeSelect(type.id)}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center mb-3 sm:mb-4">
                  <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary mr-2 sm:mr-3" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-900">
                    {type.title}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                  {type.description}
                </p>
                <ul className="text-xs text-gray-500 space-y-1 hidden sm:block">
                  {type.examples.map((example, idx) => (
                    <li key={idx}>• {example}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Application Completeness Card */}
      <Card className="mt-6 sm:mt-8">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">
              Application Completeness
            </h3>
            <span className="text-xl sm:text-2xl font-bold text-primary">
              0%
            </span>
          </div>
          <Progress value={0} className="mb-2" />
          <p className="text-xs sm:text-sm text-gray-600">
            Continue filling out details to improve your application score
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
