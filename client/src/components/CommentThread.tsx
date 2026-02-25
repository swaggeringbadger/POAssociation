import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, Check } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function CommentThread({ applicationId }: { applicationId: string }) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const { data: comments, isLoading, refetch } = useQuery({
    queryKey: [`/api/applications/${applicationId}/comments`],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}/comments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: !!applicationId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/applications/${applicationId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, parentCommentId: replyingTo }),
      });
      if (!res.ok) throw new Error("Failed to add comment");
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setNewComment("");
      setReplyingTo(null);
    },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/comments/${commentId}/resolved`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isResolved: true }),
      });
      if (!res.ok) throw new Error("Failed to resolve comment");
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  // Build thread structure
  const commentMap = new Map();
  const rootComments: any[] = [];

  comments?.forEach((c: any) => {
    commentMap.set(c.comments?.id || c.id, c);
    if (!c.parentCommentId && !c.comments?.parentCommentId) {
      rootComments.push(c);
    }
  });

  return (
    <Card data-testid="card-comment-thread">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Discussion
        </CardTitle>
        <CardDescription>{comments?.length || 0} comments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* New Comment Form */}
        <div className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="w-full min-h-24 p-3 border rounded-lg text-sm"
            data-testid="textarea-new-comment"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => addCommentMutation.mutate(newComment)}
              disabled={!newComment.trim() || addCommentMutation.isPending}
              data-testid="button-post-comment"
            >
              {addCommentMutation.isPending ? "Posting..." : "Post Comment"}
            </Button>
            {replyingTo && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setReplyingTo(null);
                  setNewComment("");
                }}
              >
                Cancel Reply
              </Button>
            )}
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-3">
          {rootComments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No comments yet</p>
          ) : (
            rootComments.map((comment: any) => {
              const commentData = comment.comments || comment;
              return (
                <div key={commentData.id} className="border rounded-lg p-4 space-y-3" data-testid={`comment-${commentData.id}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {comment.users
                          ? [comment.users.firstName, comment.users.lastName].filter(Boolean).join(' ') || 'User'
                          : comment.user
                            ? [comment.user.firstName, comment.user.lastName].filter(Boolean).join(' ') || 'User'
                            : 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(commentData.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {commentData.isResolved && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Resolved
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm whitespace-pre-wrap">{commentData.text}</p>

                  {!commentData.isResolved && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setReplyingTo(commentData.id)}
                        data-testid={`button-reply-${commentData.id}`}
                      >
                        Reply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => resolveCommentMutation.mutate(commentData.id)}
                        disabled={resolveCommentMutation.isPending}
                        data-testid={`button-resolve-${commentData.id}`}
                      >
                        Resolve
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
