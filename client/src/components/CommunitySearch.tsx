import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Building2,
  Users,
  ArrowRight,
  HelpCircle,
  Mail,
  Loader2,
} from "lucide-react";

interface SearchResult {
  id: string;
  name: string;
  subdomain: string;
  type: 'community' | 'management_company';
}

interface CommunitySearchProps {
  onSignupClick: () => void;
}

export function CommunitySearch({ onSignupClick }: CommunitySearchProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (query.length >= 2) {
        setHasSearched(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data, isLoading } = useQuery<{ results: SearchResult[] }>({
    queryKey: ['public-search', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return { results: [] };
      const response = await fetch(`/api/public/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const results = data?.results || [];
  const showDropdown = showResults && (query.length >= 2);

  const handleResultClick = (result: SearchResult) => {
    const path = result.type === 'management_company'
      ? `/management/${result.subdomain}`
      : `/community/${result.subdomain}`;
    navigate(path);
    setShowResults(false);
    setQuery("");
  };

  return (
    <section className="py-16 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Find Your Community
          </h2>
          <p className="text-muted-foreground">
            Search for your HOA, POA, or management company to access your resident portal
          </p>
        </div>

        <div ref={searchRef} className="relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by community name..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              className="pl-12 pr-4 h-14 text-lg rounded-xl border-2 focus:border-primary"
            />
            {isLoading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
            )}
          </div>

          {/* Search Results Dropdown */}
          {showDropdown && (
            <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-lg border-2 max-h-80 overflow-auto">
              <CardContent className="p-2">
                {results.length > 0 ? (
                  <div className="space-y-1">
                    {results.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        {result.type === 'management_company' ? (
                          <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
                        ) : (
                          <Users className="h-5 w-5 text-primary flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{result.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {result.type === 'management_company' ? 'Management Company' : 'Community'}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    <p className="mb-1">No communities found for "{query}"</p>
                    <p className="text-sm">Try a different search term or sign up below</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Not Finding What You're Looking For - Always visible but highlighted after search */}
        <Card className={`mt-8 transition-all duration-300 ${hasSearched && results.length === 0 ? 'ring-2 ring-primary shadow-lg' : ''}`}>
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-2">
              <div className={`p-3 rounded-full ${hasSearched && results.length === 0 ? 'bg-primary/20' : 'bg-muted'}`}>
                <HelpCircle className={`h-6 w-6 ${hasSearched && results.length === 0 ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
            </div>
            <CardTitle className="text-xl">
              {hasSearched && results.length === 0
                ? "Your community isn't on POAssociation yet?"
                : "Not finding your community?"}
            </CardTitle>
            <CardDescription>
              {hasSearched && results.length === 0
                ? "Let's change that! Get your community set up in minutes."
                : "If your HOA or POA isn't listed, you can get them started."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3 justify-center pb-6">
            <Button
              onClick={onSignupClick}
              className={hasSearched && results.length === 0 ? 'animate-pulse' : ''}
            >
              <Mail className="mr-2 h-4 w-4" />
              Request Community Setup
            </Button>
            <Button variant="outline" onClick={() => navigate('/pricing')}>
              View Pricing
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Quick Access Badges */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">Popular communities:</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 transition-colors px-4 py-1"
              onClick={() => navigate('/community/markland')}
            >
              Markland POA
            </Badge>
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 transition-colors px-4 py-1"
              onClick={() => navigate('/community/whispering-pines')}
            >
              Whispering Pines HOA
            </Badge>
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 transition-colors px-4 py-1"
              onClick={() => navigate('/management/apex')}
            >
              Apex Management
            </Badge>
          </div>
        </div>
      </div>
    </section>
  );
}
